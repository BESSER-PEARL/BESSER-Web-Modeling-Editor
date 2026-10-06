import {
  ReactFlowProvider,
  ReactFlowInstance,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
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
import { useDiagramStore, useMetadataStore } from "./store/context"
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

/** Gap kept to the canvas edge when a loaded diagram is larger than the view. */
const LOADED_MODEL_MARGIN = 40
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
 * Develop's viewport for a freshly loaded diagram: 100% zoom, diagram
 * centred, but one larger than the canvas is pinned to its top-left corner
 * instead of being cut off on every side. An empty diagram resets to the
 * origin.
 */
export async function fitViewToModel(instance: ReactFlowInstance) {
  const nodes = instance.getNodes().filter((node) => !node.hidden)
  if (nodes.length === 0) {
    await instance.setViewport({ x: 0, y: 0, zoom: 1 })
    return
  }
  await instance.fitView({ nodes, minZoom: 1, maxZoom: 1 })
  const bounds = instance.getNodesBounds(nodes)
  const { x, y } = instance.getViewport()
  await instance.setViewport({
    x: Math.max(x, LOADED_MODEL_MARGIN - bounds.x),
    y: Math.max(y, LOADED_MODEL_MARGIN - bounds.y),
    zoom: 1,
  })
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
    return filtered.length === edges.length ? edges : filtered
  }, [edges, nodeIdSet])

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
        }`}
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
        minZoom={CANVAS.MIN_SCALE_TO_ZOOM_OUT}
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
