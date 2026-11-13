import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { useSettingsStore } from "./settingsStore"

/**
 * Mode of the inspector surface.
 *
 * `panel`   — right-side properties panel.
 * `popover` — floating popover anchored to the element.
 *
 * Derived from `settingsStore.usePropertiesPanel` (true → `panel`).
 */
export type PanelMode = "panel" | "popover"

export const PANEL_MIN_WIDTH = 250
export const PANEL_MAX_WIDTH = 600
export const PANEL_DEFAULT_WIDTH = 320

export type PropertiesPanelStore = {
  /**
   * Currently selected element id surfaced to the inspector. Driven by
   * `diagramStore.selectedElementIds[0]` via subscribers; settable here
   * so consumers (e.g. the tab-keyed panel) can override.
   */
  selectedInspectorElementId: string | null
  /** Width in CSS pixels; clamped to [PANEL_MIN_WIDTH, PANEL_MAX_WIDTH]. */
  panelWidth: number
  setSelectedInspectorElementId: (id: string | null) => void
  setPanelWidth: (px: number) => void
}

const clampWidth = (px: number): number =>
  Math.min(Math.max(px, PANEL_MIN_WIDTH), PANEL_MAX_WIDTH)

export const usePropertiesPanelStore = create<PropertiesPanelStore>()(
  devtools(
    (set) => ({
      selectedInspectorElementId: null,
      panelWidth: PANEL_DEFAULT_WIDTH,
      setSelectedInspectorElementId: (id) =>
        set({ selectedInspectorElementId: id }, undefined, "setSelectedInspectorElementId"),
      setPanelWidth: (px) =>
        set({ panelWidth: clampWidth(px) }, undefined, "setPanelWidth"),
    }),
    { name: "PropertiesPanelStore", enabled: true }
  )
)

/**
 * Read the active panel mode. Derived from `settingsStore` so toggling
 * `usePropertiesPanel` causes inspector consumers to re-render reactively.
 */
export const usePanelMode = (): PanelMode =>
  useSettingsStore((s) => (s.usePropertiesPanel ? "panel" : "popover"))
