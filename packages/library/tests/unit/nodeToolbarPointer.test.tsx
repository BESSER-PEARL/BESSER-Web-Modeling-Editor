import { describe, it, expect, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import type { ReactNode } from "react"

/**
 * Upstream Apollon #708 (a press on a node-toolbar button must not pan the
 * canvas) and #791 (the selected node's toolbar must not block clicks on
 * the node behind it). React Flow's NodeToolbar needs a mounted canvas, so
 * it is replaced by a plain wrapper that forwards `style` -- the behaviour
 * under test lives in BESSER's toolbar content.
 */

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>()
  return {
    ...actual,
    NodeToolbar: ({
      children,
      style,
      isVisible,
    }: {
      children: ReactNode
      style?: React.CSSProperties
      isVisible?: boolean
    }) =>
      isVisible ? (
        <div data-testid="rf-node-toolbar" style={style}>
          {children}
        </div>
      ) : null,
  }
})

const handleDelete = vi.fn()
const setPopOverElementId = vi.fn()

vi.mock("@/hooks/useDiagramModifiable", () => ({
  useDiagramModifiable: () => true,
}))
vi.mock("@/hooks/useIsOnlyThisElementSelected", () => ({
  useIsOnlyThisElementSelected: () => true,
}))
vi.mock("@/hooks/useHandleDelete", () => ({
  useHandleDelete: () => handleDelete,
}))
vi.mock("@/store", () => ({
  usePopoverStore: (selector: (s: unknown) => unknown) =>
    selector({ setPopOverElementId }),
}))
vi.mock("@/components/toolbars/AddAssociatedObjectButton", () => ({
  AddAssociatedObjectButton: () => (
    <svg data-testid="add-button" style={{ pointerEvents: "auto" }} />
  ),
}))

import { NodeToolbar } from "@/components/toolbars/NodeToolbar"

const renderToolbar = () => {
  const paneDown = vi.fn()
  const utils = render(
    <div onPointerDown={paneDown} onMouseDown={paneDown}>
      <NodeToolbar elementId="n1" />
    </div>
  )
  return { paneDown, ...utils }
}

describe("NodeToolbar pointer handling", () => {
  it("makes the toolbar box pointer-transparent and re-enables only the buttons (#791)", () => {
    const { getByTestId, container } = renderToolbar()
    expect(getByTestId("rf-node-toolbar").style.pointerEvents).toBe("none")
    const buttons = Array.from(
      container.querySelectorAll("button, [data-testid=add-button]")
    ) as HTMLElement[]
    // edit + (+) add-associated-object (kept) + delete.
    expect(buttons).toHaveLength(3)
    buttons.forEach((button) => expect(button.style.pointerEvents).toBe("auto"))
  })

  it("marks the content nodrag/nopan and keeps presses from reaching the canvas (#708)", () => {
    const { container, paneDown } = renderToolbar()
    const box = container.querySelector(".nodrag.nopan")
    expect(box).not.toBeNull()
    const deleteIcon = container.querySelector('[aria-label="Delete"] svg')!
    const editIcon = container.querySelector('[aria-label="Edit"] svg')!
    fireEvent.pointerDown(deleteIcon)
    fireEvent.mouseDown(editIcon)
    expect(paneDown).not.toHaveBeenCalled()
  })

  it("still runs the buttons' actions", () => {
    const { container } = renderToolbar()
    const deleteIcon = container.querySelector('[aria-label="Delete"] svg')!
    const editIcon = container.querySelector('[aria-label="Edit"] svg')!
    fireEvent.click(deleteIcon)
    fireEvent.click(editIcon)
    expect(handleDelete).toHaveBeenCalled()
    expect(setPopOverElementId).toHaveBeenCalledWith("n1")
  })
})
