import React, { useEffect, useMemo, useRef } from "react"
import { useShallow } from "zustand/shallow"
import { ThemeProvider } from "@mui/material/styles"
import { useDiagramStore, useMetadataStore } from "@/store/context"
import { BesserMode } from "@/typings"
import { useResizable } from "./useResizable"
import { getInspector, InspectorKind } from "../inspectors/registry"
// SA-PANEL-STYLE: Approach B — keep MUI primitives but theme them to
// match the webapp's Tailwind/Radix design tokens. The override file
// maps borderRadius, font, padding, and focus rings to the same look as
// `packages/webapp/src/components/ui/`.
import { inspectorTheme } from "@/styles/inspector-theme"

/**
 * CSS custom property published on `:root` so fixed-position siblings (e.g.
 * the assistant widget) can offset themselves around the panel.
 *
 * Set to `0px` whenever the panel is hidden (no selection, popover mode,
 * readonly assessment, etc.) so consumers can treat it uniformly.
 */
const PANEL_WIDTH_VAR = "--besser-properties-panel-width"

/**
 * Right-side inspector for the React-Flow editor. Ports the v3
 * `properties-panel.tsx`:
 *
 * - Data source: Zustand `diagramStore.selectedElementIds[0]` instead of
 *   Redux `state.updating[0]`.
 * - Content: looked up from the new inspector registry
 *   (`components/inspectors/registry.ts`), shared with `PopoverManager`.
 * - Resizable 250–600 px (default 320), width published as
 *   `--besser-properties-panel-width`.
 *
 * Hidden when:
 * - assessment readonly mode is on,
 * - no element is selected,
 * - the registry has no `edit`/`feedbackGive`/`feedbackSee` slot for the
 *   selected element type.
 *
 * The mounting decision (`usePropertiesPanel`) lives in `App.tsx`.
 */
export const PropertiesPanel: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { width, onResizeStart } = useResizable()

  const { nodes, edges, selectedElementIds } = useDiagramStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      selectedElementIds: s.selectedElementIds,
    }))
  )

  const { mode, readonly } = useMetadataStore(
    useShallow((s) => ({ mode: s.mode, readonly: s.readonly }))
  )

  const selectedId = selectedElementIds?.[0] ?? null

  // Resolve the type of the selected element by walking nodes then edges.
  const selectedType = useMemo<string | null>(() => {
    if (!selectedId) return null
    const node = nodes.find((n) => n.id === selectedId)
    if (node) return (node.type as string | undefined) ?? null
    const edge = edges.find((e) => e.id === selectedId)
    if (edge) return (edge.type as string | undefined) ?? null
    return null
  }, [selectedId, nodes, edges])

  // Determine inspector kind from mode + readonly.
  const inspectorKind = useMemo<InspectorKind | null>(() => {
    if (mode === BesserMode.Modelling && !readonly) return "edit"
    if (mode === BesserMode.Assessment && !readonly) return "feedbackGive"
    if (mode === BesserMode.Assessment && readonly) return "feedbackSee"
    return null
  }, [mode, readonly])

  const InspectorComponent = useMemo(() => {
    if (!selectedType || !inspectorKind) return null
    return getInspector(selectedType, inspectorKind)
  }, [selectedType, inspectorKind])

  const isVisible = !!selectedId && !!InspectorComponent && !(mode === BesserMode.Exporting)

  // Sync the CSS variable so external fixed-position siblings can dodge.
  useEffect(() => {
    const totalWidth = isVisible ? width + 6 : 0
    document.documentElement.style.setProperty(PANEL_WIDTH_VAR, `${totalWidth}px`)
    return () => {
      document.documentElement.style.setProperty(PANEL_WIDTH_VAR, "0px")
    }
  }, [isVisible, width])

  if (!isVisible || !InspectorComponent || !selectedId) {
    return null
  }

  const typeLabel = formatTypeName(selectedType ?? "")

  return (
    <ThemeProvider theme={inspectorTheme}>
      <div
        ref={wrapperRef}
        className="besser-properties-panel"
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100%",
          flexShrink: 0,
        }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          className="besser-properties-panel__resize-handle"
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
        <aside
          className="besser-properties-panel__container"
          style={{
            width,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
            // SA-PANEL-STYLE: align border + shadow with the webapp's
            // `border-input` (1px) + subtle elevation-2 shadow.
            borderLeft: "1px solid var(--besser-gray, #e9ecef)",
            background: "var(--besser-background, #ffffff)",
            boxShadow:
              "-4px 0 12px -2px rgba(0, 0, 0, 0.06), -2px 0 6px -2px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div
            className="besser-properties-panel__header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--besser-gray, #e9ecef)",
              flexShrink: 0,
              userSelect: "none",
            }}
          >
            <span
              title={typeLabel}
              style={{
                // Tailwind `text-sm font-semibold` analogue (~13px / 600).
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--besser-primary-contrast, #0f172a)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontFamily:
                  'var(--font-geist-sans, "Sora"), ui-sans-serif, system-ui, sans-serif',
              }}
            >
              {typeLabel}
            </span>
          </div>
          <div
            className="besser-properties-panel__body"
            style={{
              flex: "1 1 auto",
              overflowY: "auto",
              overflowX: "hidden",
              // Tighter horizontal gutter; vertical breathing room between
              // sections is supplied by `.besser-properties-panel__body`
              // CSS rules in `app.css`.
              padding: "10px 12px",
              position: "relative",
              fontSize: "0.8125rem",
              fontFamily:
                'var(--font-geist-sans, "Sora"), ui-sans-serif, system-ui, sans-serif',
              color: "var(--besser-primary-contrast, #0f172a)",
            }}
          >
            <InspectorComponent elementId={selectedId} />
          </div>
        </aside>
      </div>
    </ThemeProvider>
  )
}

const formatTypeName = (type: string): string =>
  type.replace(/([A-Z])/g, " $1").trim()
