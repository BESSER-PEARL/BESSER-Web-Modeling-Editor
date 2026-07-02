import {
  ReactFlowProvider,
  ReactFlowInstance,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  type Node,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo } from "react"
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
import { isEnumerationClassNode } from "./utils/bpmnConstraints"
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
  const onReconnect = useReconnect()
  const { onBeforeDelete, onNodeDoubleClick, onEdgeDoubleClick } =
    useElementInteractions()
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

  const onNodeClick = useCallback(
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
    },
    [pendingAssociationEdgeId, edges, addEdge, cancelLinking]
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
        nodes={nodes}
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
          // fitView on an empty canvas stays queued until nodes exist, then
          // fires on the first one and jerks the viewport. Only fit with
          // content; empty keeps the default (0,0)/zoom-1.
          if (instance.getNodes().length > 0) {
            instance.fitView({ maxZoom: 1.0, minZoom: 1.0 })
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
