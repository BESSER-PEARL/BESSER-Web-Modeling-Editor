import { useEffect } from "react"

const CONTROLS_RIGHT_VAR = "--besser-canvas-controls-right"
// The instance that last published the variable. On an editor swap the old
// instance's cleanup runs after the new one published; it must not remove it.
let controlsRightOwner: symbol | null = null

/**
 * Publish where a canvas controls bar ends (`--besser-canvas-controls-right`)
 * so host overlays at the bottom (the webapp's "Describe your app" pill) can
 * stay clear of it. Re-measured when the bar or `container` resizes.
 */
export const usePublishControlsRight = (
  bar: HTMLElement | null | undefined,
  container?: HTMLElement | null
) => {
  useEffect(() => {
    if (!bar) return
    const root = document.documentElement
    const owner = Symbol(CONTROLS_RIGHT_VAR)
    const publish = () => {
      controlsRightOwner = owner
      root.style.setProperty(CONTROLS_RIGHT_VAR, `${Math.round(bar.getBoundingClientRect().right)}px`)
    }
    publish()
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null
    observer?.observe(bar)
    if (container) observer?.observe(container)
    window.addEventListener("resize", publish)
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", publish)
      if (controlsRightOwner === owner) {
        controlsRightOwner = null
        root.style.removeProperty(CONTROLS_RIGHT_VAR)
      }
    }
  }, [bar, container])
}
