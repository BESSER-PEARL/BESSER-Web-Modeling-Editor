import React, { useEffect, useMemo, useRef } from "react"
import { useShallow } from "zustand/shallow"
import { ThemeProvider } from "@mui/material/styles"
import {
  useDiagramStore,
  useDiagramStoreApi,
  useMetadataStore,
  usePopoverStore,
} from "@/store/context"
import { BesserMode } from "@/typings"
import { useResizable } from "./useResizable"
import { getInspector, InspectorKind } from "../inspectors/registry"
// camelCase `node.type` → inspector key aliases (package, activity*, …).
import "../inspectors/nodeTypeInspectorAliases"
import { XIcon } from "../inspectors/_shared/icons"
// Approach B — keep MUI primitives but theme them to
// match the webapp's Tailwind/Radix design tokens. The override file
// maps borderRadius, font, padding, and focus rings to the same look as
// `packages/webapp/src/components/ui/`.
import { inspectorTheme } from "@/styles/inspector-theme"
import { useTranslation } from "@/i18n"
import { getTypeLabel } from "./typeLabel"

/**
 * CSS custom property published on `:root` so fixed-position siblings (e.g.
 * the assistant widget) can offset themselves around the panel.
 *
 * Set to `0px` whenever the panel is hidden (no selection, popover mode,
 * readonly assessment, etc.) so consumers can treat it uniformly.
 */
const PANEL_WIDTH_VAR = "--besser-properties-panel-width"

/** Editable text fields of the inspector body, in document order. */
const FIELD_SELECTOR =
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])'

/** The element's name field (first field labelled "name"), else the first field. */
export const findNameField = (
  root: HTMLElement
): HTMLInputElement | HTMLTextAreaElement | null => {
  const fields = [
    ...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      FIELD_SELECTOR
    ),
  ]
  return (
    fields.find((f) =>
      /name/i.test(f.getAttribute("aria-label") || f.placeholder || "")
    ) ??
    fields[0] ??
    null
  )
}

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
  const bodyRef = useRef<HTMLDivElement>(null)
  const focusedRequestRef = useRef(0)
  const diagramStoreApi = useDiagramStoreApi()
  const { width, onResizeStart } = useResizable()
  const { t, locale } = useTranslation()

  const { nodes, edges } = useDiagramStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
    }))
  )

  // The panel opens for an EXPLICIT edit target only — set by double-click
  // or the edit (pencil) button (both go through `setPopOverElementId`),
  // never by plain selection or a palette drop. This is the same signal the
  // floating popover uses; the two surfaces are mutually exclusive
  // (PopoverManager bails out when the properties panel is the active mode).
  const {
    popoverElementId,
    popoverRequest,
    setPopOverElementId,
    retargetPopOverElementId,
  } = usePopoverStore(
    useShallow((s) => ({
      popoverElementId: s.popoverElementId,
      popoverRequest: s.popoverRequest,
      setPopOverElementId: s.setPopOverElementId,
      retargetPopOverElementId: s.retargetPopOverElementId,
    }))
  )

  const { mode, readonly, diagramType } = useMetadataStore(
    useShallow((s) => ({
      mode: s.mode,
      readonly: s.readonly,
      diagramType: s.diagramType,
    }))
  )

  const selectedId = popoverElementId ?? null

  // Resolve the type (and display name, for the header) of the selected
  // element by walking nodes then edges.
  const { selectedType, selectedName } = useMemo<{
    selectedType: string | null
    selectedName: string
  }>(() => {
    if (!selectedId) return { selectedType: null, selectedName: "" }
    const element =
      nodes.find((n) => n.id === selectedId) ??
      edges.find((e) => e.id === selectedId)
    if (!element) return { selectedType: null, selectedName: "" }
    const name = (element.data as { name?: unknown } | undefined)?.name
    return {
      selectedType: (element.type as string | undefined) ?? null,
      selectedName: typeof name === "string" ? name.trim() : "",
    }
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

  // While open, the panel follows the selection: selecting one other element
  // (with an inspector) shows that element instead.
  useEffect(() => {
    if (!isVisible || !inspectorKind) return
    return diagramStoreApi.subscribe((state, prev) => {
      if (state.selectedElementIds === prev.selectedElementIds) return
      const ids = [...new Set(state.selectedElementIds)]
      if (ids.length !== 1 || ids[0] === selectedId) return
      const element =
        state.nodes.find((n) => n.id === ids[0]) ??
        state.edges.find((e) => e.id === ids[0])
      if (!element?.type || !getInspector(element.type, inspectorKind)) return
      retargetPopOverElementId(ids[0])
    })
  }, [isVisible, inspectorKind, selectedId, diagramStoreApi, retargetPopOverElementId])

  // An explicit open (double-click / Enter / edit button) puts the caret in
  // the name field, as the old editor did. Following the selection does not:
  // focus stays on the canvas so Delete / arrows keep acting on it.
  useEffect(() => {
    if (!isVisible || focusedRequestRef.current === popoverRequest) return
    focusedRequestRef.current = popoverRequest
    const body = bodyRef.current
    const field = body && findNameField(body)
    if (!field) return
    field.focus({ preventScroll: true })
    field.select()
  }, [isVisible, popoverRequest])

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

  const typeLabel = getTypeLabel(selectedType ?? "", diagramType, locale)

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
            // Hairline + soft elevation, like the webapp sidebar.
            borderLeft: "1px solid var(--bp-border)",
            background: "var(--bp-surface)",
            boxShadow: "-8px 0 24px -12px rgba(15, 23, 42, 0.12)",
          }}
        >
          <div className="besser-properties-panel__header bp-header">
            <div className="bp-header__text">
              {selectedName ? (
                <>
                  <span className="bp-header__kind" title={typeLabel}>
                    {typeLabel}
                  </span>
                  <span className="bp-header__title" title={selectedName}>
                    {selectedName}
                  </span>
                </>
              ) : (
                <span className="bp-header__title" title={typeLabel}>
                  {typeLabel}
                </span>
              )}
            </div>
            <button
              type="button"
              className="bp-icon-btn"
              aria-label={t("propertiesPanel.closeEditor", "Close editor")}
              title={t("propertiesPanel.closeEditor", "Close editor")}
              onClick={() => setPopOverElementId(null)}
            >
              <XIcon size={16} />
            </button>
          </div>
          <div
            ref={bodyRef}
            className="besser-properties-panel__body"
            style={{
              flex: "1 1 auto",
              overflowY: "auto",
              overflowX: "hidden",
              // Tighter horizontal gutter; vertical breathing room between
              // sections is supplied by `.besser-properties-panel__body`
              // CSS rules in `app.css`.
              padding: "12px 12px 24px",
              position: "relative",
              fontSize: "0.8125rem",
              fontFamily:
                'var(--font-geist-sans, "Sora"), ui-sans-serif, system-ui, sans-serif',
              color: "var(--bp-fg)",
              overscrollBehavior: "contain",
            }}
          >
            <InspectorComponent elementId={selectedId} />
          </div>
        </aside>
      </div>
    </ThemeProvider>
  )
}

