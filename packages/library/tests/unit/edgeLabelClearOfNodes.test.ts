import { afterEach, describe, expect, it } from "vitest"
import { labelClearOfEnds } from "@/edges/curvedPath"
import { estimateMiddleLabelWidth } from "@/edges/labelTypes/middleLabelPlacement"
import { getSVG } from "@/utils/exportUtils"

/**
 * Live (multi-agent template, AgentReviewer): short transitions between
 * stacked cards put their label on a card header ("ReceiveTextEvent" over
 * Label_report, "Auto" over a card bottom), and exported edge labels lost
 * the background halo the canvas draws behind them.
 */

type Rect = { x: number; y: number; width: number; height: number }

/** Centred label box, as `EdgeMiddleLabels` draws it (12px text). */
const box = (p: { x: number; y: number }, text: string): Rect => {
  const w = estimateMiddleLabelWidth(text)
  return { x: p.x - w / 2, y: p.y - 6.5, width: w, height: 13 }
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

// Flow geometry read from the live canvas.
const greet = { x: -74, y: -128.5, width: 220, height: 90 }
const labelReport = { x: -74, y: -18.5, width: 160, height: 90 }
const checkBug = { x: -74, y: 91.5, width: 210, height: 90 }
const cards = [greet, labelReport, checkBug]

describe("short agent transition label", () => {
  it.each([
    ["ReceiveTextEvent", { x: 15, y: -29 }, { x: 30, y: -39 }, { x: 0, y: -19 }],
    ["Auto", { x: 12.5, y: 81 }, { x: 0, y: 71 }, { x: 25, y: 91 }],
  ])("%s stays off the cards", (text, mid, s, t) => {
    const p = labelClearOfEnds(mid, s, t, estimateMiddleLabelWidth(text), 10, cards)
    for (const card of cards) expect(overlaps(box(p, text), card)).toBe(false)
    // And off the arrowhead / line: not left at the curve middle.
    expect(p).not.toEqual(mid)
  })

  it("keeps a long transition's label centred", () => {
    const mid = { x: 80, y: 190 }
    expect(labelClearOfEnds(mid, { x: 80, y: 80 }, { x: 80, y: 300 }, 40, 14, cards.map((c) => ({ ...c, x: c.x + 600 })))).toEqual(mid)
  })
})

describe("exported edge labels", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  const mount = () => {
    const container = document.createElement("div")
    container.innerHTML = `<div class="react-flow__viewport">
      <svg><g class="react-flow__edge" data-id="e1">
        <path class="react-flow__edge-path" d="M0 0 L100 0"></path>
        <text class="besser-edge-label besser-edge-middle-label" x="50" y="-10">Auto</text>
      </g></svg>
    </div>`
    document.body.appendChild(container)
    return container
  }

  it.each(["web", "standalone", "compat"] as const)("keep the background halo (%s)", (svgMode) => {
    const svg = new DOMParser().parseFromString(
      getSVG(mount(), { x: 0, y: -20, width: 100, height: 40 }, { svgMode }).replace(/^<\?xml[^>]*>\s*/, ""),
      "image/svg+xml"
    )
    const label = [...svg.querySelectorAll("text")].find((t) => t.textContent === "Auto")!
    expect(label.getAttribute("paint-order")).toBe("stroke")
    expect(label.getAttribute("stroke-width")).toBe("4")
    expect(label.getAttribute("stroke")).toBeTruthy()
    if (svgMode === "compat") expect(label.getAttribute("stroke")).not.toContain("var(")
  })
})
