import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { RowColorSwatch } from "@/components/inspectors/_shared/RowColorSwatch"

/**
 * Shared per-row color swatch (Wave-3 `[attribute-per-row-color]`):
 * click opens the native color input (change commits the hex),
 * right-click resets to the theme default (`undefined`).
 */
describe("RowColorSwatch", () => {
  it("commits the picked hex through onChange", () => {
    const onChange = vi.fn()
    render(
      <RowColorSwatch
        label="Row fill color"
        value="#ff0000"
        fallbackCss="var(--besser-background, #fff)"
        onChange={onChange}
      />
    )
    const input = screen.getByLabelText("Row fill color")
    fireEvent.change(input, { target: { value: "#00ff00" } })
    expect(onChange).toHaveBeenCalledWith("#00ff00")
  })

  it("resets to undefined on right-click (contextmenu)", () => {
    const onChange = vi.fn()
    render(
      <RowColorSwatch
        label="Row text color"
        value="#123456"
        fallbackCss="var(--besser-primary-contrast, #000)"
        onChange={onChange}
      />
    )
    const input = screen.getByLabelText("Row text color")
    // The contextmenu handler sits on the wrapping label.
    fireEvent.contextMenu(input.parentElement as HTMLElement)
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it("shows the theme fallback when no value is set", () => {
    const onChange = vi.fn()
    render(
      <RowColorSwatch
        label="Row fill color"
        fallbackCss="var(--besser-background, #fff)"
        onChange={onChange}
      />
    )
    const label = screen.getByLabelText("Row fill color")
      .parentElement as HTMLElement
    expect(label).toHaveStyle({
      backgroundColor: "var(--besser-background, #fff)",
    })
  })

  it("shows the row color when set", () => {
    const onChange = vi.fn()
    render(
      <RowColorSwatch
        label="Row fill color"
        value="#abcdef"
        fallbackCss="var(--besser-background, #fff)"
        onChange={onChange}
      />
    )
    const label = screen.getByLabelText("Row fill color")
      .parentElement as HTMLElement
    expect(label).toHaveStyle({ backgroundColor: "#abcdef" })
  })
})
