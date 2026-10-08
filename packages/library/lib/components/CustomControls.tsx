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
import { CustomMiniMap } from "./CustomMiniMap"
import { ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material"
import { ThemeProvider } from "@mui/material/styles"
import { Check } from "lucide-react"
import { inspectorTheme } from "@/styles/inspector-theme"
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

// React Flow's own control icons (not exported), so the bar looks unchanged.
const ZoomInIcon = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" />
  </svg>
)
const ZoomOutIcon = () => (
  <svg viewBox="0 0 32 5" aria-hidden="true">
    <path d="M0 0h32v4.2H0z" />
  </svg>
)
const FitViewIcon = () => (
  <svg viewBox="0 0 32 30" aria-hidden="true">
    <path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" />
  </svg>
)

const CONTROLS_RIGHT_VAR = "--besser-canvas-controls-right"
// The instance that last published the variable. On an editor swap the old
// instance's cleanup runs after the new one published; it must not remove it.
let controlsRightOwner: symbol | null = null

export const CustomControls = () => {
  const { t } = useTranslation()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [minimapOpen, setMinimapOpen] = useState(false)
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()
  const zoomLevel = useStore((state) => state.transform[2])
  const minZoomReached = useStore((state) => state.transform[2] <= state.minZoom)
  const maxZoomReached = useStore((state) => state.transform[2] >= state.maxZoom)
  const domNode = useStore((state) => state.domNode)

  // Publish where the bar ends so host overlays at the bottom (the webapp's
  // "Describe your app" pill) can stay clear of it.
  useEffect(() => {
    const bar = domNode?.querySelector<HTMLElement>(".react-flow__controls")
    if (!bar) return
    const root = document.documentElement
    const owner = Symbol(CONTROLS_RIGHT_VAR)
    const publish = () => {
      controlsRightOwner = owner
      root.style.setProperty(CONTROLS_RIGHT_VAR, `${Math.round(bar.getBoundingClientRect().right)}px`)
    }
    publish()
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null
    observer?.observe(bar)
    if (domNode) observer?.observe(domNode)
    window.addEventListener("resize", publish)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", publish)
      if (controlsRightOwner === owner) {
        controlsRightOwner = null
        root.style.removeProperty(CONTROLS_RIGHT_VAR)
      }
    }
  }, [domNode])
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
    const { nodes, edges } = diagramStoreApi.getState()
    if (isLayouting || !hasNodes) return
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
