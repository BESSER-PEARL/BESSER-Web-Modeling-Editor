import React, { useRef } from "react"
import {
  CommentConfig,
  DROPS,
  dropElementConfigs,
  LAYOUT,
  ZINDEX,
} from "@/constants"
import { DividerLine } from "./ui/DividerLine"
import { useMetadataStore } from "@/store/context"
import { useSettingsStore } from "@/store/settingsStore"
import { useShallow } from "zustand/shallow"
import { DraggableGhost } from "./DraggableGhost"
import { BesserView } from "@/typings"
import { useResizableWidth } from "@/hooks/useResizableWidth"

/* ========================================================================
   Sidebar Component
   Renders the draggable elements based on the selected diagram type.
   ======================================================================== */

/**
 * Palette resize bounds — develop parity
 * (`sidebar-component.tsx`: `minWidth: 128, maxWidth: 1000`). The
 * default keeps today's 180 px (develop's 250/auto-fit initial is a
 * paradigm detail, not a capability). Width is component state only —
 * never persisted across sessions (develop had none either).
 */
export const SIDEBAR_MIN_WIDTH = 128
export const SIDEBAR_MAX_WIDTH = 1000
export const SIDEBAR_DEFAULT_WIDTH = 180

export const Sidebar = () => {
  const { diagramType, view, setView, availableViews } = useMetadataStore(
    useShallow((state) => ({
      diagramType: state.diagramType,
      view: state.view,
      setView: state.setView,
      availableViews: state.availableViews,
    }))
  )
  // Subscribe to the palette-relevant display settings so
  // dynamic palettes (ObjectDiagram instance cards — see
  // `registerDynamicPaletteProvider` in `constants.ts`) recompose live
  // when "Show Instanced Objects" / icon view are toggled. The values
  // are not read here; the subscription exists purely to re-render.
  useSettingsStore(
    useShallow((state) => ({
      showInstancedObjects: state.showInstancedObjects,
      showIconView: state.showIconView,
    }))
  )
  const showInteractiveSelectionView =
    availableViews.includes(BesserView.Highlight) ||
    view === BesserView.Highlight
  const labelPreviewTypes = new Set([
    "sfcTransitionBranch",
    "petriNetPlace",
    "petriNetTransition",
  ])

  // Drag-resizable palette width (develop parity:
  // `sidebar-component.tsx` handleResizeMouseDown). Left-anchored —
  // dragging the handle right grows the palette. Mirrors the
  // properties-panel resize pattern (`propertiesPanel/useResizable.ts`),
  // which delegates to the same `useResizableWidth` hook.
  const asideRef = useRef<HTMLElement | null>(null)
  const { width, setWidth, onResizeStart } = useResizableWidth({
    min: SIDEBAR_MIN_WIDTH,
    max: SIDEBAR_MAX_WIDTH,
    initial: SIDEBAR_DEFAULT_WIDTH,
    anchor: "left",
    onResizeEnd: snapBackToContent,
  })

  // Develop's mouseup snap-back: when the user dragged wider than the
  // palette content actually needs, shrink back to the content width
  // (`if (sidebarWidth >= element.scrollWidth) width = scrollWidth`).
  // Hoisted function declaration so it can be handed to the hook above
  // while closing over the `setWidth` it returns (the hook invokes it
  // only at mouseup, long after both are initialized).
  function snapBackToContent(finalWidth: number) {
    const el = asideRef.current
    if (!el) return
    if (finalWidth >= el.scrollWidth) {
      setWidth(el.scrollWidth)
    }
  }

  // Previously short-circuited the entire sidebar
  // whenever the active diagram had no palette entries — but the
  // Comment-sticky-note ("always-on") palette section below still needs
  // to render. Now we just stop emitting the diagram-specific block when
  // it's empty (the `dropElementConfigs[diagramType].map(...)` loop
  // naturally renders nothing in that case) and keep the Comment block.
  const diagramPaletteConfigs = dropElementConfigs[diagramType] ?? []

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        flexShrink: 0,
      }}
    >
      <aside
        ref={asideRef}
        style={{
          width: `${width}px`,
          height: "100%",
          backgroundColor: "var(--besser-background, white)",
          display: "flex",
          flexDirection: "column",
          padding: "10px",
          gap: "15px",
          alignItems: "center",
          // `overflow: auto` (not just overflowY) — at the 128 px minimum
          // the fixed-scale `DraggableGhost` previews can overflow
          // horizontally; develop scrolled both axes.
          overflow: "auto",
          flexShrink: 0,
        }}
      >
        {showInteractiveSelectionView && (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={() => setView(BesserView.Modelling)}
              style={{
                borderRadius: "8px",
                border: "1px solid var(--besser-primary-contrast, #000000)",
                background:
                  view === BesserView.Modelling
                    ? "var(--besser-primary, #3e8acc)"
                    : "transparent",
                color:
                  view === BesserView.Modelling
                    ? "var(--besser-background, #ffffff)"
                    : "var(--besser-primary-contrast, #000000)",
                padding: "8px 10px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Model
            </button>
            <button
              type="button"
              onClick={() => setView(BesserView.Highlight)}
              style={{
                borderRadius: "8px",
                border: "1px solid var(--besser-primary-contrast, #000000)",
                background:
                  view === BesserView.Highlight
                    ? "var(--besser-primary, #3e8acc)"
                    : "transparent",
                color:
                  view === BesserView.Highlight
                    ? "var(--besser-background, #ffffff)"
                    : "var(--besser-primary-contrast, #000000)",
                padding: "8px 10px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Select Elements
            </button>
          </div>
        )}

        {view === BesserView.Highlight && (
          <div
            style={{
              width: "100%",
              fontSize: "12px",
              lineHeight: 1.4,
              color: "var(--besser-primary-contrast, #000000)",
            }}
          >
            Click nodes or relationships to toggle whether they are interactive.
          </div>
        )}

        {view === BesserView.Modelling &&
          diagramPaletteConfigs.map((config, index) => {
            const extraPreviewHeight = labelPreviewTypes.has(config.type)
              ? LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
              : 0
            const previewScale = DROPS.SIDEBAR_PREVIEW_SCALE
            const previewWidth = config.width * previewScale
            const previewHeight =
              (config.height + extraPreviewHeight) * previewScale

            return (
              <React.Fragment key={`${config.type}_${config.defaultData?.name}_${index}`}>
                {/* Render a section divider + heading
                    above any palette entry tagged with `sectionLabel`.
                    For the very first entry the divider is suppressed —
                    the heading sits flush with the top edge there. */}
                {config.sectionLabel && (
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      marginTop: index === 0 ? 0 : 4,
                    }}
                  >
                    {index !== 0 && <DividerLine style={{ margin: "3px 0" }} />}
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color:
                          "var(--besser-primary-contrast, rgba(0,0,0,0.6))",
                        opacity: 0.7,
                        textAlign: "center",
                        width: "100%",
                      }}
                    >
                      {config.sectionLabel}
                    </div>
                  </div>
                )}
                <DraggableGhost dropElementConfig={config}>
                  <div
                    className="prevent-select"
                    style={{
                      width: previewWidth,
                      height: previewHeight,
                      zIndex: ZINDEX.DRAGGABLE_GHOST,
                      marginTop: config.marginTop,
                    }}
                  >
                    {React.createElement(config.svg, {
                      width: config.width,
                      height: config.height,
                      ...config.defaultData,
                      data: config.defaultData,
                      SIDEBAR_PREVIEW_SCALE: previewScale,
                      id: `sidebarElement_${index}`,
                    })}
                  </div>
                </DraggableGhost>
              </React.Fragment>
            )
          })}

        {/*
          Replace the always-on `ColorDescriptionConfig`
          block with the free-form sticky-note `CommentConfig`. The
          ColorDescription node renderer + inspector code stay in the tree
          — re-enabling is a one-line swap here when a designer needs the
          legend back. Comments tether to elements: drawing a connection
          from/to a comment creates a dashed `CommentLink` edge (see
          `resolveCommentEdgeType` in `utils/edgeUtils.ts`).
        */}
        {view === BesserView.Modelling && (
          <>
            <DividerLine style={{ margin: "3px 0" }} />
            <DraggableGhost dropElementConfig={CommentConfig}>
              <div
                className="prevent-select"
                style={{
                  width:
                    CommentConfig.width * DROPS.SIDEBAR_PREVIEW_SCALE,
                  height:
                    CommentConfig.height * DROPS.SIDEBAR_PREVIEW_SCALE,
                  zIndex: ZINDEX.DRAGGABLE_GHOST,
                  marginTop: CommentConfig.marginTop,
                }}
              >
                {React.createElement(CommentConfig.svg, {
                  width: CommentConfig.width,
                  height: CommentConfig.height,
                  ...CommentConfig.defaultData,
                  data: CommentConfig.defaultData,
                  SIDEBAR_PREVIEW_SCALE: DROPS.SIDEBAR_PREVIEW_SCALE,
                  id: "sidebarElement_Comment",
                })}
              </div>
            </DraggableGhost>
          </>
        )}
      </aside>
      {/* Resize handle — mirrors the PropertiesPanel separator markup,
          but left-anchored: drag RIGHT to grow (develop's 128–1000 px
          `handleResizeMouseDown` behavior). */}
      <div
        role="separator"
        aria-orientation="vertical"
        className="besser-sidebar__resize-handle"
        onMouseDown={onResizeStart}
        style={{
          width: 6,
          cursor: "ew-resize",
          background: "transparent",
          userSelect: "none",
          flexShrink: 0,
          pointerEvents: "auto",
        }}
      />
    </div>
  )
}
