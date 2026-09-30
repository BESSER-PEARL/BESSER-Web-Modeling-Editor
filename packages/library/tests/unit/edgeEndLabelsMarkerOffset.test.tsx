import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { EdgeEndLabels } from "@/edges/labelTypes/EdgeEndLabels"

// End labels start just past the end marker (develop 8d19140a: the
// aggregation diamond plus its arrowhead reaches further back along the line).
const renderLabels = (sourceMarkerLength?: number, targetMarkerLength?: number) =>
  render(
    <svg>
      <EdgeEndLabels
        data={{ sourceRole: "src", targetRole: "tgt" }}
        activePoints={[
          { x: 0, y: 0 },
          { x: 200, y: 0 },
        ]}
        sourceX={0}
        sourceY={0}
        targetX={200}
        targetY={0}
        sourcePosition="right"
        targetPosition="left"
        sourceMarkerLength={sourceMarkerLength}
        targetMarkerLength={targetMarkerLength}
      />
    </svg>
  )

const xOf = (container: HTMLElement, text: string) => {
  const node = [...container.querySelectorAll("text")].find(
    (t) => t.textContent === text
  )
  return Number(node?.getAttribute("x"))
}

describe("EdgeEndLabels marker offset", () => {
  it("keeps the labels in place when there is no marker", () => {
    const plain = renderLabels()
    const zero = renderLabels(0, 0)
    expect(xOf(zero.container, "src")).toBe(xOf(plain.container, "src"))
    expect(xOf(zero.container, "tgt")).toBe(xOf(plain.container, "tgt"))
  })

  it("moves each end's labels along the line past its marker", () => {
    const plain = renderLabels()
    const marked = renderLabels(24, 40)
    // Source end: the line leaves towards +x, labels move right by length + 1.
    expect(xOf(marked.container, "src") - xOf(plain.container, "src")).toBe(25)
    // Target end: the line arrives from -x, labels move left by length + 1.
    expect(xOf(plain.container, "tgt") - xOf(marked.container, "tgt")).toBe(41)
  })
})
