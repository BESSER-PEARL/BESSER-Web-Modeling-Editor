import { describe, expect, it } from "vitest"

/**
 * The palette table in `constants.ts` references SVG components that import
 * `@/constants` back. Read at module evaluation, it threw a TDZ error
 * ("Cannot access 'ReachabilityGraphMarkingSVG' before initialization") and
 * blanked the production build whenever the cycle was entered from a
 * component module first, as here.
 */
describe("palette import cycle", () => {
  it("builds the palette when the cycle is entered from an SVG module", async () => {
    const { ReachabilityGraphMarkingSVG } = await import(
      "@/components/svgs/nodes/reachabilityGraphDiagram/ReachabilityGraphMarkingSVG"
    )
    const { dropElementConfigs } = await import("@/constants")
    expect(dropElementConfigs.ReachabilityGraph[0].svg).toBe(
      ReachabilityGraphMarkingSVG
    )
    expect(dropElementConfigs.ClassDiagram.length).toBeGreaterThan(0)
  }, 60_000)
})
