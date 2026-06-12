import { useEffect } from "react"
import {
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  usePropertiesPanelStore,
} from "@/store/propertiesPanelStore"
import { useResizableWidth } from "@/hooks/useResizableWidth"

/**
 * Mouse-driven resizer hook for the right-side properties panel.
 *
 * Thin wrapper over the generic `useResizableWidth` hook
 * (`lib/hooks/useResizableWidth.ts`) with the panel's 250–600 px bounds
 * and right-anchored drag math (**drag leftwards to grow** — the panel
 * sits on the right edge).
 *
 * Returns:
 * - `width`           — current panel width (CSS px), clamped to
 *                       [PANEL_MIN_WIDTH, PANEL_MAX_WIDTH].
 * - `onResizeStart`   — `mousedown` handler to attach to the resize handle.
 *
 * Width is mirrored into `propertiesPanelStore` so external readers
 * (e.g. the assistant widget that follows the panel edge via
 * `--besser-properties-panel-width`) stay in sync.
 */
export const useResizable = (
  initial: number = PANEL_DEFAULT_WIDTH
): { width: number; onResizeStart: (e: React.MouseEvent<HTMLDivElement>) => void } => {
  const storeWidth = usePropertiesPanelStore((s) => s.panelWidth)
  const setStoreWidth = usePropertiesPanelStore((s) => s.setPanelWidth)

  const { width, setWidth, onResizeStart } = useResizableWidth({
    min: PANEL_MIN_WIDTH,
    max: PANEL_MAX_WIDTH,
    initial: storeWidth ?? initial,
    anchor: "right",
    // Drag moves mirror into the store; programmatic `setWidth` calls
    // below do NOT fire `onChange`, so the store→local sync can't echo.
    onChange: setStoreWidth,
  })

  // Keep local state in sync with store-driven changes (e.g. another tab,
  // settings reset, programmatic resize). Deliberately depends on
  // `storeWidth` only — re-running on local `width` changes would fight
  // the drag.
  useEffect(() => {
    if (storeWidth !== width) {
      setWidth(storeWidth)
    }
  }, [storeWidth])

  return { width, onResizeStart }
}
