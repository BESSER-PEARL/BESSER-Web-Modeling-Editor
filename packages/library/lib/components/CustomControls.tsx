import { useEffect, useState, type MouseEvent } from "react"
import { Controls, useReactFlow, useStore } from "@xyflow/react"
import {
  useDiagramStore,
  useDiagramStoreApi,
  useMetadataStore,
} from "@/store/context"
import { useShallow } from "zustand/shallow"
import { UndoIcon } from "./Icon/UndoIcon"
import { RedoIcon } from "./Icon/RedoIcon"
import { AutoLayoutIcon } from "./Icon/AutoLayoutIcon"
import { MapIcon } from "./Icon/MapIcon"
import { FitViewIcon, ZoomInIcon, ZoomOutIcon } from "./Icon/ZoomIcons"
import { usePublishControlsRight } from "@/hooks/usePublishControlsRight"
import { CustomMiniMap } from "./CustomMiniMap"
import { ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material"
import { ThemeProvider } from "@mui/material/styles"
import { Check } from "lucide-react"
import { inspectorTheme } from "@/styles/inspector-theme"
import {
  computeAutoLayout,
  mergeLayoutResult,
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
  const [minimapOpen, setMinimapOpen] = useState(false)
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()
  const zoomLevel = useStore((state) => state.transform[2])
  const minZoomReached = useStore((state) => state.transform[2] <= state.minZoom)
  const maxZoomReached = useStore((state) => state.transform[2] >= state.maxZoom)
  const domNode = useStore((state) => state.domNode)

  // Rendered by <Controls> below, so it is looked up once mounted.
  const [controlsBar, setControlsBar] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setControlsBar(domNode?.querySelector<HTMLElement>(".react-flow__controls") ?? null)
  }, [domNode])
  usePublishControlsRight(controlsBar, domNode)
  const zoomLevelPercent = Math.round(zoomLevel * 100)
  const [isLayouting, setIsLayouting] = useState(false)

  // `hasNodes`, not the node list: the controls must not re-render on every
  // drag step. Auto-layout reads the live nodes/edges when it runs.
  const { canUndo, canRedo, undo, redo, undoManagerExist, hasNodes, setNodesAndEdges } = useDiagramStore(
    useShallow((state) => ({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      undo: state.undo,
      redo: state.redo,
      undoManagerExist: state.undoManager !== null,
      hasNodes: state.nodes.length > 0,
      setNodesAndEdges: state.setNodesAndEdges,
    }))
  )
  const diagramStoreApi = useDiagramStoreApi()
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
    const before = diagramStoreApi.getState()
    if (isLayouting || !hasNodes) return
    setIsLayouting(true)
    try {
      lastStrategy.set(diagramType, strategy)
      const layouted = await computeAutoLayout(before.nodes, before.edges, diagramType, { strategy })
      // Merged into the live diagram (edits made while ELK ran survive);
      // one store write → one undo step.
      const merged = mergeLayoutResult(before, layouted, diagramStoreApi.getState())
      setNodesAndEdges(merged.nodes, merged.edges)
      window.requestAnimationFrame(() => fitView({ duration: 300, padding: 0.1 }))
    } finally {
      setIsLayouting(false)
    }
  }

  return (
    <ThemeProvider theme={inspectorTheme}>
      <Controls
        orientation="horizontal"
        showZoom={false}
        showFitView={false}
        showInteractive={false}
      >
        {/* Zoom group: own buttons so the labels are translated. */}
        <Tooltip title={t("zoomPane.zoomIn", "Zoom in")}>
          <span>
            <button
              type="button"
              className={`control-button ${maxZoomReached ? "disabled" : ""}`}
              aria-label={t("zoomPane.zoomIn", "Zoom in")}
              onClick={() => void zoomIn()}
              disabled={maxZoomReached}
            >
              <ZoomInIcon />
            </button>
          </span>
        </Tooltip>
        <Tooltip title={t("zoomPane.zoomOut", "Zoom out")}>
          <span>
            <button
              type="button"
              className={`control-button ${minZoomReached ? "disabled" : ""}`}
              aria-label={t("zoomPane.zoomOut", "Zoom out")}
              onClick={() => void zoomOut()}
              disabled={minZoomReached}
            >
              <ZoomOutIcon />
            </button>
          </span>
        </Tooltip>
        <Tooltip title={t("zoomPane.fitView", "Fit view")}>
          <button
            type="button"
            className="control-button"
            aria-label={t("zoomPane.fitView", "Fit view")}
            onClick={() => void fitView({ padding: 0.1, duration: 200 })}
          >
            <FitViewIcon />
          </button>
        </Tooltip>
        {/* Undo / Redo history group */}
        {undoManagerExist && (
          <>
            <span className="control-divider" aria-hidden="true" />
            <Tooltip title={t("toolbar.undo", "Undo (Ctrl+Z)")}>
              <span>
                <button
                  className={`control-button ${!canUndo ? "disabled" : ""}`}
                  aria-label={t("toolbar.undo", "Undo (Ctrl+Z)")}
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
                  aria-label={t("toolbar.redo", "Redo (Ctrl+Y or Ctrl+Shift+Z)")}
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
              className={`control-button ${isLayouting || !hasNodes ? "disabled" : ""}`}
              aria-label={t("toolbar.autoLayout", "Auto-layout diagram")}
              onClick={() => void handleAutoLayout()}
              disabled={isLayouting || !hasNodes}
            >
              <AutoLayoutIcon
                width={16}
                height={16}
                fill={
                  !isLayouting && hasNodes
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
                  className={`control-button control-button--caret ${isLayouting || !hasNodes ? "disabled" : ""}`}
                  aria-haspopup="menu"
                  aria-label={t("toolbar.autoLayoutOptions", "Auto-layout options")}
                  onClick={(e: MouseEvent<HTMLButtonElement>) => setMenuAnchor(e.currentTarget)}
                  disabled={isLayouting || !hasNodes}
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
                  <ListItemIcon sx={{ minWidth: 24, color: "var(--besser-primary, #35798c)" }}>
                    {strategy === currentStrategy ? <Check size={14} strokeWidth={2.25} aria-hidden="true" /> : null}
                  </ListItemIcon>
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
          <button
            type="button"
            className="control-zoom-readout"
            aria-label={t("toolbar.resetZoom", "Reset zoom to 100%")}
            onClick={() => zoomTo(1)}
          >
            {zoomLevelPercent}%
          </button>
        </Tooltip>
        {/* Minimap toggle — the map opens above this bar. */}
        <span className="control-divider" aria-hidden="true" />
        <Tooltip title={t("toolbar.minimap", "Minimap")}>
          <button
            type="button"
            className="control-button"
            aria-label={t("toolbar.minimap", "Minimap")}
            aria-pressed={minimapOpen}
            onClick={() => setMinimapOpen((open) => !open)}
          >
            <MapIcon width={16} height={16} />
          </button>
        </Tooltip>
      </Controls>
      {minimapOpen && <CustomMiniMap onClose={() => setMinimapOpen(false)} />}
    </ThemeProvider>
  )
}
