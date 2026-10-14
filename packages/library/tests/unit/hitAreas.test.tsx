import { describe, it, expect, vi } from "vitest"
// @ts-expect-error -- Node types are not part of the test tsconfig.
import { existsSync, readFileSync } from "node:fs"
import { render } from "@testing-library/react"

/**
 * Upstream Apollon #801: overhanging and hidden hit areas must not steal
 * clicks. jsdom does not apply stylesheets, so the CSS half is asserted as a
 * contract on `styles/app.css`; the edge toolbar is rendered.
 */

vi.mock("@/hooks/useDiagramModifiable", () => ({
  useDiagramModifiable: () => true,
}))
const selected = { value: false }
vi.mock("@/hooks/useIsOnlyThisElementSelected", () => ({
  useIsOnlyThisElementSelected: () => selected.value,
}))

import { CustomEdgeToolbar } from "@/components/toolbars/edgeToolBar/CustomEdgeToolBar"

// Relative to the working directory: the library package (workspace
// script) or the monorepo root.
const cssPath = ["lib/styles/app.css", "packages/library/lib/styles/app.css"].find(
  (candidate) => existsSync(candidate)
) as string
const css = (readFileSync(cssPath, "utf8") as string)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")

/** Declarations of the (first) rule whose selector list contains `selector`. */
const ruleFor = (selector: string, scope = css): string | undefined => {
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(scope))) {
    const selectors = m[1].split(",").map((s) => s.trim())
    if (selectors.includes(selector)) return m[2]
  }
  return undefined
}

describe("node affordance hit areas (app.css)", () => {
  it("keeps connection arcs and handles inert until the node is hovered", () => {
    expect(ruleFor(".react-flow__handle.besser-arc-handle::before")).toMatch(
      /pointer-events: none/
    )
    expect(ruleFor(".react-flow__handle.connectionindicator")).toMatch(
      /pointer-events: none/
    )
    expect(
      ruleFor(".react-flow__node:hover .react-flow__handle.besser-arc-handle::before")
    ).toMatch(/pointer-events: all/)
    expect(
      ruleFor(".react-flow__node:hover .react-flow__handle.connectionindicator")
    ).toMatch(/pointer-events: all/)
  })

  it("arms resize controls on hover only (a selected node stays visible but click-through)", () => {
    expect(
      ruleFor(".react-flow__node:hover .react-flow__resize-control")
    ).toMatch(/pointer-events: all/)
    const selectedRule = ruleFor(
      ".react-flow__node.selected .react-flow__resize-control"
    )
    expect(selectedRule).toMatch(/opacity: 1/)
    expect(selectedRule).not.toMatch(/pointer-events/)
    expect(ruleFor(".react-flow__node.selected .react-flow__handle")).not.toMatch(
      /pointer-events/
    )
  })

  it("falls back to selection-armed affordances on touch (no :hover)", () => {
    const media = /@media \(hover: none\), \(pointer: coarse\) \{(.*?\})\s*\}/.exec(
      css
    )
    expect(media).not.toBeNull()
    const inner = media![1]
    for (const selector of [
      ".react-flow__node.selected .react-flow__handle.connectionindicator",
      ".react-flow__node.selected .react-flow__resize-control",
      ".react-flow__node.selected .react-flow__handle.besser-arc-handle::before",
    ]) {
      expect(ruleFor(selector, inner)).toMatch(/pointer-events: all/)
    }
  })
})

describe("edge toolbar pass-through", () => {
  const renderToolbar = () =>
    render(
      <svg>
        <CustomEdgeToolbar
          edgeId="e1"
          position={{ x: 100, y: 100 }}
          onEditClick={() => {}}
          onDeleteClick={() => {}}
          anchorRef={() => {}}
        />
      </svg>
    )

  it("never lets the always-present anchor box capture the pointer", () => {
    selected.value = false
    const { container } = renderToolbar()
    const fo = container.getElementsByTagNameNS(
      "http://www.w3.org/2000/svg",
      "foreignObject"
    )[0] as SVGElement
    expect(fo).not.toBeNull()
    expect(fo.style.pointerEvents).toBe("none")
  })

  it("re-enables only the toolbar buttons when shown", () => {
    selected.value = true
    const { container } = renderToolbar()
    const box = container.querySelector(".besser-edge-toolbar") as HTMLElement
    expect(box).not.toBeNull()
    expect(getComputedStyle(box).pointerEvents).toBe("none")
    const buttons = Array.from(box.children) as HTMLElement[]
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    buttons.forEach((button) =>
      expect(getComputedStyle(button).pointerEvents).toBe("auto")
    )
  })
})
