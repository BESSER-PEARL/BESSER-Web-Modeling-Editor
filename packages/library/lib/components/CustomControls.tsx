import { useState } from "react"
import { Controls, useReactFlow, useStore } from "@xyflow/react"
import { useDiagramStore, useMetadataStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { UndoIcon } from "./Icon/UndoIcon"
import { RedoIcon } from "./Icon/RedoIcon"
import { AutoLayoutIcon } from "./Icon/AutoLayoutIcon"
import { Tooltip } from "@mui/material"
import { computeAutoLayout } from "@/utils/autoLayout"

export const CustomControls = () => {
  const { zoomTo, fitView } = useReactFlow()
  const zoomLevel = useStore((state) => state.transform[2])
  const zoomLevelPercent = Math.round(zoomLevel * 100)
  const [isLayouting, setIsLayouting] = useState(false)

  const { canUndo, canRedo, undo, redo, undoManagerExist, nodes, edges, setNodesAndEdges } = useDiagramStore(
    useShallow((state) => ({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      undo: state.undo,
      redo: state.redo,
      undoManagerExist: state.undoManager !== null,
      nodes: state.nodes,
      edges: state.edges,
      setNodesAndEdges: state.setNodesAndEdges,
    }))
  )
  const diagramType = useMetadataStore(useShallow((state) => state.diagramType))

  const handleUndo = () => {
    undo()
  }

  const handleRedo = () => {
    redo()
  }

  const handleAutoLayout = async () => {
    if (isLayouting || nodes.length === 0) return
    setIsLayouting(true)
    try {
      const layouted = await computeAutoLayout(nodes, edges, diagramType)
      setNodesAndEdges(layouted.nodes, layouted.edges)
      window.requestAnimationFrame(() => fitView({ duration: 300, padding: 0.1 }))
    } finally {
      setIsLayouting(false)
    }
  }

  return (
    <Controls
      orientation="horizontal"
      showInteractive={false}
      style={{ display: "flex", gap: 4, alignItems: "center" }}
    >
      {/* Undo Button */}
      {undoManagerExist && (
        <Tooltip title="Undo (Ctrl+Z)">
          <span>
            <button
              className={`control-button ${!canUndo ? "disabled" : ""}`}
              onClick={handleUndo}
              disabled={!canUndo}
            >
              <UndoIcon
                width={16}
                height={16}
                fill={
                  canUndo
                    ? "var(--besser-primary-contrast, #000000)"
                    : "var(--besser-secondary, #6c757d)"
                }
              />
            </button>
          </span>
        </Tooltip>
      )}
      {/* Redo Button */}
      {undoManagerExist && (
        <Tooltip title="Redo (Ctrl+Y or Ctrl+Shift+Z)">
          <span>
            <button
              className={`control-button ${!canRedo ? "disabled" : ""}`}
              onClick={handleRedo}
              disabled={!canRedo}
            >
              <RedoIcon
                width={16}
                height={16}
                fill={
                  canRedo
                    ? "var(--besser-primary-contrast, #000000)"
                    : "var(--besser-secondary, #6c757d)"
                }
              />
            </button>
          </span>
        </Tooltip>
      )}
      {/* Auto-layout Button */}
      <Tooltip title="Auto-layout diagram">
        <span>
          <button
            className={`control-button ${isLayouting || nodes.length === 0 ? "disabled" : ""}`}
            onClick={handleAutoLayout}
            disabled={isLayouting || nodes.length === 0}
          >
            <AutoLayoutIcon
              width={16}
              height={16}
              fill={
                !isLayouting && nodes.length > 0
                  ? "var(--besser-primary-contrast, #000000)"
                  : "var(--besser-secondary, #6c757d)"
              }
            />
          </button>
        </span>
      </Tooltip>
      <div
        style={{
          userSelect: "none",
          border: "1px solid var(--besser-primary-contrast, #000000)",
          borderRadius: 8,
          paddingLeft: 4,
          paddingRight: 4,
          cursor: "pointer",
          display: "flex",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--besser-primary-contrast, #000000)",
        }}
        onClick={() => zoomTo(1)}
      >
        {zoomLevelPercent}%
      </div>
    </Controls>
  )
}
