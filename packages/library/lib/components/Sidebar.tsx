import React from "react"
import {
  CommentConfig,
  DROPS,
  dropElementConfigs,
  LAYOUT,
  ZINDEX,
} from "@/constants"
import { DividerLine } from "./ui/DividerLine"
import { useMetadataStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { DraggableGhost } from "./DraggableGhost"
import { BesserView } from "@/typings"

/* ========================================================================
   Sidebar Component
   Renders the draggable elements based on the selected diagram type.
   ======================================================================== */

export const Sidebar = () => {
  const { diagramType, view, setView, availableViews } = useMetadataStore(
    useShallow((state) => ({
      diagramType: state.diagramType,
      view: state.view,
      setView: state.setView,
      availableViews: state.availableViews,
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

  if (dropElementConfigs[diagramType].length === 0) {
    return null
  }

  return (
    <aside
      style={{
        width: "180px",
        minWidth: "180px",
        height: "100%",
        backgroundColor: "var(--besser-background, white)",
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        gap: "15px",
        alignItems: "center",
        overflowY: "auto",
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
        dropElementConfigs[diagramType].map((config, index) => {
          const extraPreviewHeight = labelPreviewTypes.has(config.type)
            ? LAYOUT.DEFAULT_ATTRIBUTE_HEIGHT
            : 0
          const previewScale = DROPS.SIDEBAR_PREVIEW_SCALE
          const previewWidth = config.width * previewScale
          const previewHeight =
            (config.height + extraPreviewHeight) * previewScale

          return (
            <React.Fragment key={`${config.type}_${config.defaultData?.name}_${index}`}>
              {/* SA-FIX-NN-DROPS: render a section divider + heading
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
        SA-HIDE-NOISE: replace the always-on `ColorDescriptionConfig`
        block with the free-form sticky-note `CommentConfig`. The
        ColorDescription node renderer + inspector code stay in the tree
        — re-enabling is a one-line swap here when a designer needs the
        legend back. Comments are intentionally untethered for now;
        binding to elements can be added later.
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
  )
}
