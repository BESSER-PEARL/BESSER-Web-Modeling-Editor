import { useState, type RefCallback } from "react"

/**
 * Tracks a node/edge wrapper element so it can anchor a popover, returning
 * the live element and a callback ref to attach to it (ported from upstream
 * Apollon):
 *
 * ```tsx
 * const [anchorEl, anchorRef] = usePopoverAnchor()
 * return (
 *   <>
 *     <div ref={anchorRef}>...</div>
 *     <PopoverManager anchorEl={anchorEl} ... />
 *   </>
 * )
 * ```
 *
 * Capturing the element in state via a callback ref -- rather than reading
 * a `useRef` `.current` during render -- keeps the render pure and
 * re-renders the popover the moment its anchor mounts. The old
 * `ref.current` approach left the popover anchorless (nothing opened on the
 * first request) until some later, unrelated render happened to read the
 * populated ref.
 */
export function usePopoverAnchor<T extends Element = HTMLDivElement>(): [
  T | null,
  RefCallback<T>,
] {
  // The state setter doubles as the callback ref (React calls it with the
  // element or null); typed as RefCallback so callers treat it as a ref.
  return useState<T | null>(null)
}
