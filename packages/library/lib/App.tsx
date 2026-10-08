import {
  ReactFlowProvider,
  ReactFlowInstance,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  useStore,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import {
  CustomBackground,
  CustomControls,
  CustomMiniMap,
  Sidebar,
  AssessmentSelectionDebug,
  ScrollOverlay,
  AlignmentGuides,
} from "@/components"
import "@xyflow/react/dist/style.css"
import "@/styles/app.css"
import "@/styles/connections.css"
import {
  useDiagramStore,
  useMetadataStore,
  usePopoverStore,
} from "./store/context"
import { useShallow } from "zustand/shallow"
import { CANVAS } from "./constants"
import { diagramEdgeTypes } from "./edges"
import {
  useNodeDragStop,
  useConnect,
  useReconnect,
  useElementInteractions,
  useDragOver,
  useNodeDrag,
} from "./hooks"
import { diagramNodeTypes } from "./nodes"
import { useDiagramModifiable } from "./hooks/useDiagramModifiable"
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts"
import { usePaneClicked } from "./hooks/usePaneClicked"
import { BesserMode } from "./typings"
import { getConnectionLineType } from "./utils/edgeUtils"
import { isEdgeAnchoredLinkRel } from "./utils/associationClassLink"
import {
  isEnumerationClassNode,
  applyBpmnCollapseVisibility,
} from "./utils/bpmnConstraints"
import { useEdgeLinkingStore } from "./store/edgeLinkingStore"
import { generateUUID } from "./utils"
import { FLOATING_PORT_DIAGRAMS } from "./utils/floatingEdges"
import { FloatingConnectionLine } from "./edges/FloatingConnectionLine"
import { PropertiesPanel } from "./components/propertiesPanel/PropertiesPanel"
import { useUsePropertiesPanel } from "./store/settingsStore"
// Side-effect import: seed BESSER inspector overrides into the shared
// `inspectors/registry.ts`. Both `PropertiesPanel` and `PopoverManager`
// resolve their bodies from that registry, so this single import wires
// the new ClassEditPanel / ObjectEditPanel into both surfaces.
import "./components/inspectors"

interface AppProps {
  onReactFlowInit: (instance: ReactFlowInstance) => void
}
const proOptions = { hideAttribution: true }

/**
 * Identity-stable wrapper that always calls the latest `fn`. React Flow
 * hands its element handlers to every NodeWrapper / EdgeWrapper (memo), so
 * a handler re-created per drag frame (it closes over `nodes` / `edges`)
 * re-rendered every node and edge on every frame.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useStableHandler<T extends (...args: any[]) => any>(fn: T): T {
  const latest = useRef(fn)
  useLayoutEffect(() => {
    latest.current = fn
  })
  return useCallback(
    ((...args: Parameters<T>) => latest.current(...args)) as T,
    []
  )
}

/**
 * Space kept free around a loaded diagram; the bottom one clears the canvas
 * toolbar and the host's prompt pill that float over the canvas.
 */
const LOADED_MODEL_PADDING = { top: 40, right: 40, bottom: 96, left: 40 }
/** Lowest zoom a loaded diagram is shrunk to so that it fits. */
export const LOADED_MODEL_MIN_ZOOM = 0.3
/** Upper bound (~2 s) on waiting for React Flow to render a loaded model. */
const MAX_RENDER_WAIT_FRAMES = 120

/**
 * Calls `done` once React Flow has rendered and measured every node of
 * `expected` (the model just written to the store); a model swap is only on
 * screen after React re-renders and the ResizeObserver reports sizes. Gives
 * up waiting after `MAX_RENDER_WAIT_FRAMES`. Returns a cancel function.
 */
export function whenModelRendered(
  instance: ReactFlowInstance,
  expected: () => Node[],
  done: () => void
): () => void {
  let frames = 0
  let rafId = 0
  const isRendered = () =>
    expected().every((node) => {
      const internal = instance.getInternalNode(node.id)
      if (!internal) return false
      if (internal.hidden) return true
      return (
        !!internal.measured.width &&
        !!internal.measured.height &&
        internal.position.x === node.position.x &&
        internal.position.y === node.position.y
      )
    })
  const tick = () => {
    frames += 1
    if (frames > 1 && (isRendered() || frames > MAX_RENDER_WAIT_FRAMES)) {
      done()
      return
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafId)
}

/**
 * Viewport for a freshly loaded diagram: the whole diagram fits inside the
 * padded canvas (clear of the bottom toolbar), never zoomed in past 100%
 * and never below `LOADED_MODEL_MIN_ZOOM`; one still too large at that zoom
 * is pinned to its top-left corner instead of being cut off on every side.
 * An empty diagram resets to the origin.
 */
export async function fitViewToModel(instance: ReactFlowInstance) {
  const nodes = instance.getNodes().filter((node) => !node.hidden)
  if (nodes.length === 0) {
    await instance.setViewport({ x: 0, y: 0, zoom: 1 })
    return
  }
  // A 100% fit centres the bounds; the canvas size follows from that.
  await instance.fitView({ nodes, minZoom: 1, maxZoom: 1 })
  const bounds = instance.getNodesBounds(nodes)
  const centred = instance.getViewport()
  const width = 2 * (centred.x + bounds.x) + bounds.width
  const height = 2 * (centred.y + bounds.y) + bounds.height
  const pad = LOADED_MODEL_PADDING
  const availW = Math.max(1, width - pad.left - pad.right)
  const availH = Math.max(1, height - pad.top - pad.bottom)
  const zoom = Math.min(
    1,
    Math.max(
      LOADED_MODEL_MIN_ZOOM,
      Math.min(availW / bounds.width, availH / bounds.height)
    )
  )
  const fitsX = bounds.width * zoom <= availW
  const fitsY = bounds.height * zoom <= availH
  await instance.setViewport({
    x: fitsX
      ? pad.left + (availW - bounds.width * zoom) / 2 - bounds.x * zoom
      : pad.left - bounds.x * zoom,
    y: fitsY
      ? pad.top + (availH - bounds.height * zoom) / 2 - bounds.y * zoom
      : pad.top - bounds.y * zoom,
    zoom,
  })
}

/**
 * Edge types without their own endpoint grips: React Flow's reconnect
 * anchors are their only way to reconnect, so those stay on (selected only).
 */
const RF_RECONNECT_EDGE_TYPES: ReadonlySet<string> = new Set([
  "SfcDiagramEdge",
  "SyntaxTreeLink",
  "UseCaseAssociation",
  "UseCaseInclude",
  "UseCaseExtend",
  "UseCaseGeneralization",
])

/**
 * React Flow draws reconnect anchors over BOTH ends of every edge, on top of
 * the node handles: pressing a handle that already had an edge grabbed that
 * edge and moved it instead of starting a new one. Only a selected edge's
 * ends are reconnectable now (and only for types without their own grips).
 */
export const withReconnectableFlags = (edges: Edge[]): Edge[] => {
  let changed = false
  const out = edges.map((edge) => {
    const reconnectable =
      !!edge.selected && RF_RECONNECT_EDGE_TYPES.has(edge.type ?? "")
    if (edge.reconnectable === reconnectable) return edge
    changed = true
    return { ...edge, reconnectable }
  })
  return changed ? out : edges
}

/** Space kept between an element revealed for editing and the canvas edge. */
const REVEAL_MARGIN_PX = 24

/**
 * Viewport shift (screen px) that brings `rect` inside a `width` x `height`
 * canvas with `margin` around it; an element larger than the canvas is
 * aligned to its top-left. Zero when already visible. Exported for tests.
 */
export const revealShift = (
  rect: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
  margin = REVEAL_MARGIN_PX
): { dx: number; dy: number } => {
  const axis = (start: number, size: number, extent: number) => {
    let d = 0
    if (start + size > extent - margin) d = extent - margin - (start + size)
    if (start + d < margin) d = margin - start
    return d
  }
  return {
    dx: axis(rect.x, rect.width, width),
    dy: axis(rect.y, rect.height, height),
  }
}

/**
 * Opening the properties panel narrows the canvas; pans the edited node back
 * into view when the panel now covers it.
 */
function useRevealEditedNode(enabled: boolean) {
  const popoverElementId = usePopoverStore((s) => s.popoverElementId)
  const { getInternalNode, getViewport, setViewport } = useReactFlow()
  const domNode = useStore((s) => s.domNode)
  useEffect(() => {
    if (!enabled || !popoverElementId || !domNode) return
    // Two frames: the panel has mounted and the canvas has been re-laid out.
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const node = getInternalNode(popoverElementId)
        if (!node || node.hidden) return
        const { x, y, zoom } = getViewport()
        const pos = node.internals.positionAbsolute
        const canvas = domNode.getBoundingClientRect()
        const { dx, dy } = revealShift(
          {
            x: pos.x * zoom + x,
            y: pos.y * zoom + y,
            width: (node.measured.width ?? node.width ?? 0) * zoom,
            height: (node.measured.height ?? node.height ?? 0) * zoom,
          },
          canvas.width,
          canvas.height
        )
        if (dx || dy) {
          void setViewport({ x: x + dx, y: y + dy, zoom }, { duration: 200 })
        }
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [enabled, popoverElementId, domNode, getInternalNode, getViewport, setViewport])
}

function App({ onReactFlowInit }: AppProps) {
  useKeyboardShortcuts()

  const { nodes, onNodesChange, edges, onEdgesChange, diagramId, addEdge } =
    useDiagramStore(
      useShallow((state) => ({
        nodes: state.nodes,
        onNodesChange: state.onNodesChange,
        edges: state.edges,
        onEdgesChange: state.onEdgesChange,
        diagramId: state.diagramId,
        addEdge: state.addEdge,
      }))
    )

  const { mode, diagramType, readonly, scrollLock, scrollEnabled } =
    useMetadataStore(
      useShallow((state) => ({
        mode: state.mode,
        diagramType: state.diagramType,
        readonly: state.readonly,
        scrollLock: state.scrollLock,
        scrollEnabled: state.scrollEnabled,
      }))
    )

  const isDiagramModifiable = useDiagramModifiable()
  // BESSER embed defaults to `true` — properties panel is the primary editing
  // surface. Toggling `usePropertiesPanel` in `settingsService` flips this
  // reactively without remounting the editor (replaces v3 `editorRevision++`).
  const showPropertiesPanel = useUsePropertiesPanel()
  useRevealEditedNode(showPropertiesPanel && mode !== BesserMode.Exporting)

  const connectionLineType = getConnectionLineType(diagramType)
  const onNodeDragStop = useNodeDragStop()
  const onNodeDrag = useNodeDrag()
  const onDragOver = useDragOver()
  const {
    onConnect,
    onConnectEnd,
    onConnectStart,
    onEdgesDelete,
    isValidConnection,
  } = useConnect()
  const onReconnect = useStableHandler(useReconnect())
  const interactions = useElementInteractions()
  const onBeforeDelete = useStableHandler(interactions.onBeforeDelete)
  const onNodeDoubleClick = useStableHandler(interactions.onNodeDoubleClick)
  const onEdgeDoubleClick = useStableHandler(interactions.onEdgeDoubleClick)
  const { onPaneClicked } = usePaneClicked()

  const handleReactFlowInit = useCallback(
    (instance: ReactFlowInstance) => {
      onReactFlowInit(instance)
    },
    [onReactFlowInit]
  )

  // Edge-anchored ClassLinkRel edges (association-class links whose
  // endpoint is an association EDGE id) cannot be rendered by React
  // Flow — filter them from the edges prop. They stay in
  // `diagramStore.edges` (Yjs) so model getters / exports round-trip
  // them untouched; `ClassDiagramEdge` draws them as a dashed overlay.
  const nodeIdSet = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes])
  const renderableEdges = useMemo(() => {
    const filtered = edges.filter((e) => !isEdgeAnchoredLinkRel(e, nodeIdSet))
    return withReconnectableFlags(
      filtered.length === edges.length ? edges : filtered
    )
  }, [edges, nodeIdSet])

  const floatingPorts = FLOATING_PORT_DIAGRAMS.has(diagramType)
  const isConnecting = useStore((s) => s.connection.inProgress)

  // A collapsed BPMN Subprocess/Transaction renders only itself — none of
  // its descendants (mirrors the old editor's render()). React Flow has no
  // container-collapse primitive, so this derives `hidden` from the
  // `parentId` chain on every nodes change; it auto-hides edges with a
  // hidden endpoint, so no edge-level handling is needed here.
  const visibleNodes = useMemo(
    () => applyBpmnCollapseVisibility(nodes),
    [nodes]
  )

  // Association-class authoring (click-to-pick): "Attach association
  // class" on an association's midpoint toolbar arms
  // `pendingAssociationEdgeId`; clicking a (non-Enumeration) class node
  // completes the link with the backend's canonical orientation
  // (source = association edge id, sourceHandle "Center").
  const { pendingAssociationEdgeId, cancelLinking } = useEdgeLinkingStore(
    useShallow((state) => ({
      pendingAssociationEdgeId: state.pendingAssociationEdgeId,
      cancelLinking: state.cancelLinking,
    }))
  )

  const onNodeClick = useStableHandler(
    (_event: React.MouseEvent, node: Node) => {
      if (!pendingAssociationEdgeId) return
      // Stale-id guard: the pending association must still exist in
      // THIS diagram's edges (the linking store is module-level).
      const associationExists = edges.some(
        (e) => e.id === pendingAssociationEdgeId
      )
      const isLinkableClass =
        node.type === "class" && !isEnumerationClassNode(node)
      if (associationExists && isLinkableClass) {
        addEdge({
          id: generateUUID(),
          source: pendingAssociationEdgeId,
          sourceHandle: "Center",
          target: node.id,
          targetHandle: "top",
          type: "ClassLinkRel",
          selected: false,
          data: { points: [] },
        })
      }
      cancelLinking()
    }
  )

  // Escape cancels a pending association-class link pick.
  useEffect(() => {
    if (!pendingAssociationEdgeId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelLinking()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [pendingAssociationEdgeId, cancelLinking])

  const handlePaneClicked = useCallback(() => {
    cancelLinking()
    onPaneClicked()
  }, [cancelLinking, onPaneClicked])

  return (
    <div
      className={`besser-editor ${readonly ? "besser-editor--readonly" : ""}`}
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "var(--besser-background, #ffffff)",
        position: "relative",
      }}
    >
      {mode === BesserMode.Modelling && !readonly && <Sidebar />}
      <ReactFlow
        id={`react-flow-library-${diagramId}`}
        className={`besser-container${
          pendingAssociationEdgeId ? " besser-container--linking" : ""
        }${isConnecting ? " besser-container--connecting" : ""}`}
        nodeTypes={diagramNodeTypes}
        edgeTypes={diagramEdgeTypes}
        nodes={visibleNodes}
        edges={renderableEdges}
        onDragOver={onDragOver}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        zoomOnDoubleClick={false}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onReconnect={onReconnect}
        connectionLineType={connectionLineType}
        connectionLineComponent={
          floatingPorts ? FloatingConnectionLine : undefined
        }
        reconnectRadius={8}
        connectionMode={ConnectionMode.Loose}
        // Lift the selected edge (and its bend/endpoint handles) above other
        // edges so an overlapping edge's interaction ribbon can't steal the
        // pointer from a visible handle.
        elevateEdgesOnSelect
        onInit={(instance) => {
          // Only fit with content; empty keeps the default (0,0)/zoom-1.
          if (instance.getNodes().length > 0) {
            whenModelRendered(
              instance,
              () => instance.getNodes(),
              () => void fitViewToModel(instance)
            )
          }
          handleReactFlowInit(instance)
        }}
        minZoom={Math.min(CANVAS.MIN_SCALE_TO_ZOOM_OUT, LOADED_MODEL_MIN_ZOOM)}
        maxZoom={CANVAS.MAX_SCALE_TO_ZOOM_IN}
        snapToGrid
        snapGrid={[CANVAS.SNAP_TO_GRID_PX, CANVAS.SNAP_TO_GRID_PX]}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onBeforeDelete={onBeforeDelete}
        // Keyboard deletion is owned by `useKeyboardShortcuts`, which skips
        // focused controls (React Flow's own Backspace handler does not).
        deleteKeyCode={null}
        onPaneClick={handlePaneClicked}
        proOptions={proOptions}
        edgesReconnectable={isDiagramModifiable}
        nodesConnectable={isDiagramModifiable}
        nodesDraggable={isDiagramModifiable}
        panOnScroll={!scrollLock || scrollEnabled}
        zoomOnScroll={!scrollLock || scrollEnabled}
        // Default to selection-on-drag (left button)
        // and pan with middle/right button — matches v3 mouse-eventlistener
        // behavior. Without this, marquee-select requires holding Shift.
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        // Develop (Apollon) toggled multi-select with Shift+click; React Flow
        // defaults to Meta/Control only — accept all three for parity.
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
      >
        <CustomBackground />
        <CustomMiniMap />
        <CustomControls />
        <AlignmentGuides />
        <AssessmentSelectionDebug />
      </ReactFlow>
      {/* Drop the `mode === Modelling` gate so the
          properties panel mounts in Assessment mode too. The panel itself
          decides what to render per-mode (edit / feedbackGive /
          feedbackSee) via the inspector registry. PopoverManager already
          mutually-excludes against `usePropertiesPanel`, so without this
          mounting fix Assessment mode showed neither inspector surface. */}
      {showPropertiesPanel && mode !== BesserMode.Exporting && <PropertiesPanel />}
      <ScrollOverlay />
    </div>
  )
}

export function AppWithProvider(props: AppProps) {
  return (
    <ReactFlowProvider>
      <App {...props} />
    </ReactFlowProvider>
  )
}
