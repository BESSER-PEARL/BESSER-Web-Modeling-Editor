import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { MARKER_CONFIGS } from "@/constants"
import { InlineMarker } from "@/components/svgs/edges/InlineMarker"
import { getEdgeMarkerStyles } from "@/utils/edgeUtils"

/**
 * Upstream Apollon #805: aggregation / composition diamonds sized to match
 * the inheritance triangle. Adapted to BESSER's diamond-on-target-end
 * rendering (`getEdgeMarkerStyles` puts the rhombus on `markerEnd`, drawn
 * by `InlineMarker` tip-on-endpoint).
 */

type Id = keyof typeof MARKER_CONFIGS
// Both shapes are inscribed in their bounding box: width * height / 2 is
// their exact area -- a proxy for visual weight.
const inkArea = (id: Id) => {
  const { size, widthFactor, heightFactor } = MARKER_CONFIGS[id]
  return (size * widthFactor * (size * heightFactor)) / 2
}
const height = (id: Id) =>
  MARKER_CONFIGS[id].size * MARKER_CONFIGS[id].heightFactor

describe("class diagram marker geometry (#805)", () => {
  it("draws both diamonds identically apart from the fill", () => {
    const { filled: _b, ...black } = MARKER_CONFIGS["black-rhombus"]
    const { filled: _w, ...white } = MARKER_CONFIGS["white-rhombus"]
    expect(black).toEqual(white)
    expect(MARKER_CONFIGS["black-rhombus"].filled).toBe(true)
    expect(MARKER_CONFIGS["white-rhombus"].filled).toBe(false)
  })

  it("gives the diamond at least the inheritance triangle's visual weight", () => {
    expect(inkArea("black-rhombus")).toBeGreaterThanOrEqual(
      inkArea("white-triangle")
    )
  })

  it("keeps the diamond no taller than the inheritance triangle", () => {
    // Height = extent perpendicular to the edge = overhang past the node border.
    expect(height("black-rhombus")).toBeLessThanOrEqual(height("white-triangle"))
  })

  it("keeps the diamond's thickness in the band used by reference tools", () => {
    const { widthFactor, heightFactor } = MARKER_CONFIGS["black-rhombus"]
    const aspect = heightFactor / widthFactor
    expect(aspect).toBeGreaterThanOrEqual(0.588)
    expect(aspect).toBeLessThanOrEqual(0.706)
  })

  it("still renders on the target (whole) end, tip touching the endpoint", () => {
    expect(getEdgeMarkerStyles("ClassComposition").markerEnd).toBe(
      "url(#black-rhombus)"
    )
    expect(getEdgeMarkerStyles("ClassAggregation").markerEnd).toBe(
      "url(#white-rhombus)"
    )
    const { container } = render(
      <svg>
        <InlineMarker
          endPoint={{ x: 100, y: 50 }}
          direction={0}
          markerId="black-rhombus"
        />
      </svg>
    )
    const d = container.querySelector("path")!.getAttribute("d")!
    const pts = [...d.matchAll(/(-?\d+),(-?\d+)/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }))
    // front (tip) on the endpoint, back vertex one full diamond length behind.
    expect(pts[0]).toEqual({ x: 100, y: 50 })
    expect(pts[2]).toEqual({ x: 100 - MARKER_CONFIGS["black-rhombus"].size, y: 50 })
  })
})
