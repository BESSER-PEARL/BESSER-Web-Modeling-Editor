import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  AgenticBotIcon,
  BPMNGovernanceBadgeIcon,
  BPMNMergeMarkerIcon,
  BPMNReflectionMarkerIcon,
} from "@/components/svgs/icons/agentic"
import {
  relationshipLabelDirection,
  relationshipLabelLayout,
  relationshipMidpoint,
} from "@/utils/relationshipMidpoint"

const inSvg = (ui: React.ReactElement) => render(<svg>{ui}</svg>)

describe("agentic glyphs", () => {
  it("bot icon sits at (x, y) in the parent SVG and takes the theme colour by default", () => {
    inSvg(<AgenticBotIcon x={8} y={8} />)
    const g = screen.getByTestId("agentic-bot-icon")
    expect(g.getAttribute("transform")).toBe("translate(8, 8)")
    expect(g.getAttribute("pointer-events")).toBe("none")
    const paths = g.querySelectorAll("path")
    expect(paths).toHaveLength(5)
    expect(paths[0].getAttribute("stroke")).toBe("var(--besser-primary-contrast)")
  })

  it("bot icon scales with size and uses the given colour", () => {
    inSvg(<AgenticBotIcon x={0} y={4} size={24} color="#f00" />)
    const g = screen.getByTestId("agentic-bot-icon")
    expect(g.getAttribute("transform")).toBe("translate(0, 4) scale(1.5)")
    g.querySelectorAll("path").forEach((p) => expect(p.getAttribute("stroke")).toBe("#f00"))
  })

  it("markers are nested SVGs at (x, y) with develop's default sizes and viewBoxes", () => {
    inSvg(
      <>
        <BPMNReflectionMarkerIcon x={72} y={55} letter="s" />
        <BPMNMergeMarkerIcon x={28} y={28} color="#123456" />
        <BPMNGovernanceBadgeIcon x={28} y={-6} />
      </>
    )
    const reflection = screen.getByTestId("bpmn-reflection-marker")
    expect([reflection.getAttribute("x"), reflection.getAttribute("y")]).toEqual(["72", "55"])
    expect([reflection.getAttribute("width"), reflection.getAttribute("height")]).toEqual(["16", "21"])
    expect(reflection.getAttribute("viewBox")).toBe("0 0 24 32")
    expect(reflection.querySelector("text")?.textContent).toBe("s")

    const merge = screen.getByTestId("bpmn-merge-marker")
    expect([merge.getAttribute("width"), merge.getAttribute("viewBox")]).toEqual(["16", "0 0 18 16"])
    expect(merge.getAttribute("stroke")).toBe("#123456")

    const badge = screen.getByTestId("bpmn-governance-badge")
    expect([badge.getAttribute("width"), badge.getAttribute("height")]).toEqual(["14", "14"])
    expect(badge.getAttribute("stroke")).toBe("var(--besser-primary-contrast)")
  })
})

describe("relationshipMidpoint", () => {
  it("finds the half-length point of an orthogonal route and its axis", () => {
    // 100 right, then 50 down: half of 150 is 75 along the first segment.
    expect(relationshipMidpoint([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }])).toEqual({
      position: { x: 75, y: 0 },
      direction: "h",
    })
    // 20 right, then 100 down: 60 along, i.e. 40 into the vertical segment.
    expect(relationshipMidpoint([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 100 }])).toEqual({
      position: { x: 20, y: 40 },
      direction: "v",
    })
  })

  it("puts a midpoint on a vertex onto the following segment, as develop did", () => {
    expect(relationshipMidpoint([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toEqual({
      position: { x: 10, y: 0 },
      direction: "v",
    })
  })

  it("handles diagonal and degenerate paths", () => {
    const diagonal = relationshipMidpoint([{ x: 0, y: 0 }, { x: 30, y: 40 }])
    expect(diagonal.position.x).toBeCloseTo(15)
    expect(diagonal.position.y).toBeCloseTo(20)
    expect(diagonal.direction).toBe("v")
    expect(relationshipMidpoint([{ x: 5, y: 5 }, { x: 5, y: 5 }])).toEqual({ position: { x: 5, y: 5 }, direction: "v" })
    expect(relationshipMidpoint([])).toEqual({ position: { x: 0, y: 0 }, direction: "v" })
  })

  it("maps the edge hooks' axis flag and lays labels out beside / above the line", () => {
    expect(relationshipLabelDirection(true)).toBe("h")
    expect(relationshipLabelDirection(false)).toBe("v")
    expect(relationshipLabelLayout("v")).toEqual({ dx: 5, dominantBaseline: "middle", textAnchor: "start" })
    expect(relationshipLabelLayout("h")).toEqual({ dy: -5, dominantBaseline: "text-after-edge", textAnchor: "middle" })
  })
})
