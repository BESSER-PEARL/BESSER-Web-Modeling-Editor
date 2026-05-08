import { useCallback, useEffect, useState } from "react"
import {
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  usePropertiesPanelStore,
} from "@/store/propertiesPanelStore"

/**
 * Mouse-driven resizer hook for the right-side properties panel.
 *
 * Returns:
 * - `width`           — current panel width (CSS px), clamped to
 *                       [PANEL_MIN_WIDTH, PANEL_MAX_WIDTH].
 * - `onResizeStart`   — `mousedown` handler to attach to the resize handle.
 *
 * The handle drags **leftwards to grow** (panel sits on the right edge).
 * Width is mirrored into `propertiesPanelStore` so external readers
 * (e.g. the assistant widget that follows the panel edge) stay in sync.
 */
export const useResizable = (
  initial: number = PANEL_DEFAULT_WIDTH
): { width: number; onResizeStart: (e: React.MouseEvent<HTMLDivElement>) => void } => {
  const storeWidth = usePropertiesPanelStore((s) => s.panelWidth)
  const setStoreWidth = usePropertiesPanelStore((s) => s.setPanelWidth)
  const [width, setWidth] = useState<number>(storeWidth ?? initial)

  // Keep local state in sync with store-driven changes (e.g. another tab,
  // settings reset, programmatic resize).
  useEffect(() => {
    if (storeWidth !== width) {
      setWidth(storeWidth)
    }
  }, [storeWidth]) // eslint-disable-line react-hooks/exhaustive-deps

  const clamp = (px: number): number =>
    Math.min(Math.max(px, PANEL_MIN_WIDTH), PANEL_MAX_WIDTH)

  const onResizeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      const startX = e.clientX
      const startWidth = width

      const onMouseMove = (moveEvent: MouseEvent) => {
        // Drag left to grow (panel anchored right).
        const next = clamp(startWidth - (moveEvent.clientX - startX))
        setWidth(next)
        setStoreWidth(next)
      }

      const onMouseUp = () => {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("mouseup", onMouseUp)
      }

      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
    },
    [width, setStoreWidth]
  )

  return { width, onResizeStart }
}
