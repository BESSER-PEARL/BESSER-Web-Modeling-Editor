import type { KeyboardEvent } from "react"

/**
 * Props that make a non-<button> toolbar icon keyboard-operable (develop
 * a8eac70c): focusable, named, and Enter / Space fire its click handler.
 */
export const keyboardButtonProps = (label: string) => ({
  role: "button",
  tabIndex: 0,
  "aria-label": label,
  className: "besser-canvas-button",
  onKeyDown: (event: KeyboardEvent<Element>) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    )
  },
})
