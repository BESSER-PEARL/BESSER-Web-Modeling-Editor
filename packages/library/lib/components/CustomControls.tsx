import { useState, type MouseEvent } from "react"
import { Controls, useReactFlow, useStore } from "@xyflow/react"
import { useDiagramStore, useMetadataStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { UndoIcon } from "./Icon/UndoIcon"
import { RedoIcon } from "./Icon/RedoIcon"
import { AutoLayoutIcon } from "./Icon/AutoLayoutIcon"
import { ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material"
import {
  computeAutoLayout,
  getAutoLayoutStrategies,
  type AutoLayoutStrategy,
} from "@/utils/autoLayout"
import { useTranslation } from "@/i18n"

/** Last strategy picked per diagram type (session memory for the main button). */
const lastStrategy = new Map<string, AutoLayoutStrategy>()

const STRATEGY_LABELS: Record<AutoLayoutStrategy, { key: string; fallback: string }> = {
  hierarchical: { key: "toolbar.autoLayoutStrategy.hierarchical", fallback: "Hierarchical" },
  compact: { key: "toolbar.autoLayoutStrategy.compact", fallback: "Compact" },
  horizontal: { key: "toolbar.autoLayoutStrategy.horizontal", fallback: "Left to right" },
  vertical: { key: "toolbar.autoLayoutStrategy.vertical", fallback: "Top to bottom" },
}

export const CustomControls = () => {
  const { t } = useTranslation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
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

  const strategies = getAutoLayoutStrategies(diagramType)
  const currentStrategy = lastStrategy.get(diagramType) ?? strategies[0]

  const handleAutoLayout = async (strategy: AutoLayoutStrategy = currentStrategy) => {
    if (isLayouting || nodes.length === 0) return
    setIsLayouting(true)
    try {
      lastStrategy.set(diagramType, strategy)
      const layouted = await computeAutoLayout(nodes, edges, diagramType, { strategy })
      // One store write → one undo step.
      setNodesAndEdges(layouted.nodes, layouted.edges)
      window.requestAnimationFrame(() => fitView({ duration: 300, padding: 0.1 }))
    } finally {
      setIsLayouting(false)
    }
  }

  return (
    <Controls orientation="horizontal" showInteractive={false}>
      {/* Undo / Redo history group (separated from the built-in zoom group) */}
      {undoManagerExist && (
        <>
          <span className="control-divider" aria-hidden="true" />
          <Tooltip title={t("toolbar.undo", "Undo (Ctrl+Z)")}>
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
          <Tooltip title={t("toolbar.redo", "Redo (Ctrl+Y or Ctrl+Shift+Z)")}>
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
        </>
      )}
      {/* Auto-layout group */}
      <span className="control-divider" aria-hidden="true" />
      <Tooltip
        title={
          strategies.length > 1
            ? `${t("toolbar.autoLayout", "Auto-layout diagram")} (${t(
                STRATEGY_LABELS[currentStrategy].key,
                STRATEGY_LABELS[currentStrategy].fallback
              )})`
            : t("toolbar.autoLayout", "Auto-layout diagram")
        }
      >
        <span>
          <button
            className={`control-button ${isLayouting || nodes.length === 0 ? "disabled" : ""}`}
            onClick={() => void handleAutoLayout()}
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
      {strategies.length > 1 && (
        <>
          <Tooltip title={t("toolbar.autoLayoutOptions", "Auto-layout options")}>
            <span>
              <button
                className={`control-button control-button--caret ${isLayouting || nodes.length === 0 ? "disabled" : ""}`}
                aria-haspopup="menu"
                aria-label={t("toolbar.autoLayoutOptions", "Auto-layout options")}
                onClick={(e: MouseEvent<HTMLButtonElement>) => setMenuAnchor(e.currentTarget)}
                disabled={isLayouting || nodes.length === 0}
                style={{ width: 16, minWidth: 16 }}
              >
                <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
                  <path
                    d="M1.5 3.5 5 7l3.5-3.5"
                    fill="none"
                    stroke="var(--besser-primary-contrast, #000000)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </span>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={menuAnchor !== null}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "top", horizontal: "left" }}
            transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            {strategies.map((strategy) => (
              <MenuItem
                key={strategy}
                selected={strategy === currentStrategy}
                onClick={() => {
                  setMenuAnchor(null)
                  void handleAutoLayout(strategy)
                }}
              >
                <ListItemIcon sx={{ minWidth: 24 }}>{strategy === currentStrategy ? "✓" : ""}</ListItemIcon>
                <ListItemText>
                  {t(STRATEGY_LABELS[strategy].key, STRATEGY_LABELS[strategy].fallback)}
                </ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {/* Zoom-percentage readout — click to reset to 100% */}
      <span className="control-divider" aria-hidden="true" />
      <Tooltip title={t("toolbar.resetZoom", "Reset zoom to 100%")}>
        <div className="control-zoom-readout" onClick={() => zoomTo(1)}>
          {zoomLevelPercent}%
        </div>
      </Tooltip>
    </Controls>
  )
}
