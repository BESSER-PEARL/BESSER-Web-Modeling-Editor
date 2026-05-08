import { create } from "zustand"
import { devtools } from "zustand/middleware"
import {
  ClassNotation,
  IApplicationSettings,
  settingsService,
} from "@/services/settingsService"

/**
 * Zustand mirror of `settingsService`.
 *
 * - The service remains the source of truth for persistence (localStorage
 *   key `besser-standalone-settings`) and external broadcasts.
 * - This store auto-syncs on creation by subscribing to
 *   `settingsService.onSettingsChange`. Components subscribe via the
 *   selectors below to get live, fine-grained re-renders when settings
 *   change — replacing the v3 `editorRevision++` hack.
 * - Mutations go through `settingsService.updateSetting`, which writes to
 *   localStorage and notifies all listeners (including this store, so
 *   external setters update the Zustand state too).
 */
export type SettingsStore = IApplicationSettings & {
  /** Update a single setting (proxies `settingsService.updateSetting`). */
  updateSetting: <K extends keyof IApplicationSettings>(
    key: K,
    value: IApplicationSettings[K]
  ) => void
  /** Reset all settings to defaults. */
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    (set) => {
      // Initial snapshot from the service.
      const initial = settingsService.getSettings()

      // Subscribe to broadcasts so external mutations propagate into the store.
      // This handle is intentionally never disposed: the settings service is a
      // singleton with the same lifetime as the page, and the listener simply
      // calls Zustand's `set` (idempotent if values match).
      settingsService.onSettingsChange((next) => {
        set(next, undefined, "settings/sync")
      })

      return {
        ...initial,
        updateSetting: (key, value) => {
          settingsService.updateSetting(key, value)
        },
        resetToDefaults: () => {
          settingsService.resetToDefaults()
        },
      }
    },
    { name: "SettingsStore", enabled: true }
  )
)

/* -------------------------------------------------------------------------- */
/* Selectors — keep call sites short and stable                                */
/* -------------------------------------------------------------------------- */

/** Return the entire settings snapshot. Use sparingly (re-renders on any change). */
export const useSettings = (): IApplicationSettings =>
  useSettingsStore((s) => ({
    showInstancedObjects: s.showInstancedObjects,
    showIconView: s.showIconView,
    showAssociationNames: s.showAssociationNames,
    usePropertiesPanel: s.usePropertiesPanel,
    classNotation: s.classNotation,
  }))

/** ER↔UML notation flag, read by class-row renderers. */
export const useClassNotation = (): ClassNotation =>
  useSettingsStore((s) => s.classNotation)

/** Whether the right-side properties panel is the active editing surface. */
export const useUsePropertiesPanel = (): boolean =>
  useSettingsStore((s) => s.usePropertiesPanel)
