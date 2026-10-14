import { useCallback, useRef, useState } from "react"

export interface UseResizableWidthOptions {
  /** Lower clamp bound (CSS px). */
  min: number
  /** Upper clamp bound (CSS px). */
  max: number
  /** Initial width (CSS px); clamped into [min, max] on first render. */
  initial: number
  /**
   * Which screen edge the panel is anchored to:
   *
   * - `left`  — the handle sits on the panel's RIGHT edge, dragging
   *             right (+dx) grows the panel (palette sidebar).
   * - `right` — the handle sits on the panel's LEFT edge, dragging
   *             left (−dx) grows the panel (properties panel).
   */
  anchor: "left" | "right"
  /**
   * Fired with the clamped width on every drag move. NOT fired by
   * programmatic `setWidth` calls — consumers that mirror the width
   * into an external store (see `propertiesPanel/useResizable.ts`)
   * use this to avoid echo loops when syncing store → local state.
   */
  onChange?: (width: number) => void
  /** Fired once with the final width when the drag ends (mouseup). */
  onResizeEnd?: (width: number) => void
}

export interface UseResizableWidthResult {
  /** Current width (CSS px), always clamped to [min, max]. */
  width: number
  /** Programmatic setter (clamped); does not fire `onChange`. */
  setWidth: (px: number) => void
  /** `mousedown` handler to attach to the resize handle. */
  onResizeStart: (e: React.MouseEvent<HTMLDivElement>) => void
}

/**
 * Generic mouse-driven width resizer for edge-anchored panels.
 *
 * Generalizes the properties-panel resize pattern
 * (`components/propertiesPanel/useResizable.ts`, which now delegates
 * here) so the left-anchored palette sidebar can reuse the identical
 * drag mechanics — develop parity for `sidebar-component.tsx`'s
 * `handleResizeMouseDown`:
 *
 * - mousedown sets `document.body` cursor to `col-resize` and disables
 *   text selection for the duration of the drag,
 * - mousemove computes `startWidth ± dx` (sign per `anchor`) clamped
 *   to [min, max],
 * - mouseup restores cursor / selection and removes the window
 *   listeners.
 */
export const useResizableWidth = ({
  min,
  max,
  initial,
  anchor,
  onChange,
  onResizeEnd,
}: UseResizableWidthOptions): UseResizableWidthResult => {
  const clamp = useCallback(
    (px: number): number => Math.min(Math.max(px, min), max),
    [min, max]
  )

  const [width, setWidthState] = useState<number>(() => clamp(initial))
  // Mirror of `width` readable inside the drag listeners without
  // re-binding them (and without stale-closure bugs on rapid drags).
  const latestWidth = useRef(width)

  // Keep the latest callbacks in refs so `onResizeStart` stays stable
  // even when consumers pass inline arrow functions.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onResizeEndRef = useRef(onResizeEnd)
  onResizeEndRef.current = onResizeEnd

  const setWidth = useCallback(
    (px: number) => {
      const next = clamp(px)
      latestWidth.current = next
      setWidthState(next)
    },
    [clamp]
  )

  const onResizeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      const startX = e.clientX
      const startWidth = latestWidth.current
      // Left-anchored panels grow with +dx, right-anchored with −dx.
      const direction = anchor === "left" ? 1 : -1

      const onMouseMove = (moveEvent: MouseEvent) => {
        const next = clamp(startWidth + direction * (moveEvent.clientX - startX))
        latestWidth.current = next
        setWidthState(next)
        onChangeRef.current?.(next)
      }

      const onMouseUp = () => {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("mouseup", onMouseUp)
        onResizeEndRef.current?.(latestWidth.current)
      }

      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
    },
    [anchor, clamp]
  )

  return { width, setWidth, onResizeStart }
}
