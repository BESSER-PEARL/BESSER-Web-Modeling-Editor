import { describe, it, expect, afterEach, vi } from "vitest"
import {
  getSVG,
  inlineSvgImages,
  snapshotLightPalette,
  __testing,
} from "@/utils/exportUtils"

const { getNodeBoundsFromDOM } = __testing
const CLIP = { x: 0, y: 0, width: 400, height: 300 }

/** A React Flow viewport holding the given node markup. */
function mountViewport(nodesHtml: string): HTMLElement {
  const container = document.createElement("div")
  container.innerHTML = `<div class="react-flow__viewport">${nodesHtml}</div>`
  document.body.appendChild(container)
  return container
}

// Shaped nodes (state, BPMN, agent, NN) render the PortBand handle -- an
// <svg> -- BEFORE the body svg (continuous ports, 9ae6b98e).
const SHAPED_NODE = `
  <div class="react-flow__node" data-id="s1" style="transform: translate(20px, 30px); width: 200px; height: 100px;">
    <div class="react-flow__handle besser-port-band besser-port-band--shaped">
      <svg class="besser-port-band__svg" width="200" height="100">
        <path class="besser-port-outline" d="M0 0 H200 V100 H0 Z"></path>
      </svg>
    </div>
    <div>
      <svg width="200" height="100" viewBox="0 0 200 100">
        <rect width="200" height="100" fill="white" stroke="black"></rect>
        <text x="10" y="20">Red</text>
      </svg>
    </div>
  </div>`

afterEach(() => {
  document.body.innerHTML = ""
  document.head.innerHTML = ""
  document.documentElement.removeAttribute("data-theme")
  document.documentElement.classList.remove("dark")
})

describe("getSVG node body selection", () => {
  it("exports the node body, not the PortBand hover svg (black boxes, no labels)", () => {
    const svg = getSVG(mountViewport(SHAPED_NODE), CLIP, { svgMode: "web" })
    expect(svg).toContain(">Red</text>")
    expect(svg).not.toContain("besser-port-band")
    expect(svg).not.toContain("besser-port-outline")
  })

  it("replaces foreignObject bodies with SVG text (a foreignObject taints the PNG canvas)", () => {
    const container = mountViewport(`
      <div class="react-flow__node" data-id="c1" style="transform: translate(0px, 0px); width: 200px; height: 100px;">
        <div>
          <svg width="200" height="100" viewBox="0 0 200 100">
            <rect width="200" height="100"></rect>
            <foreignObject x="0" y="20" width="200" height="80">
              <div><div>x = 1</div><div>light_body</div></div>
            </foreignObject>
          </svg>
        </div>
      </div>`)
    const svg = getSVG(container, CLIP, { svgMode: "web" })
    expect(svg).not.toContain("foreignObject")
    expect(svg).toContain(">x = 1</text>")
    expect(svg).toContain(">light_body</text>")
  })

  it("serializes HTML cards (agent states) into SVG text, keeping name and replies", () => {
    const container = mountViewport(`
      <div class="react-flow__node" data-id="a1" style="transform: translate(0px, 0px); width: 220px; height: 120px;">
        <div data-export-html="">
          <div>
            <span><svg width="15" height="15" viewBox="0 0 24 24"><path d="M0 0"></path></svg></span>
            <div><span><span>state</span><span>initial</span></span><span>Greeting</span></div>
          </div>
          <div><div><span>Hello! How can I help?</span></div></div>
        </div>
      </div>`)
    const svg = getSVG(container, CLIP, { svgMode: "web" })
    expect(svg).toContain(">Greeting</text>")
    expect(svg).toContain(">Hello! How can I help?</text>")
    expect(svg).not.toContain("data-export-html")
  })
})

describe("export bounds without layout (headless server render)", () => {
  it("sizes a node from its svg when the DOM reports 0x0 rects (class diagram clipped right/bottom)", () => {
    // conversion-service shims getBBox to 10x10; jsdom rects are all 0.
    const proto = SVGElement.prototype as unknown as { getBBox?: unknown }
    const original = proto.getBBox
    proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 })
    try {
      const container = mountViewport(`
        <div class="react-flow__node" data-id="n1" style="transform: translate(100px, 50px); width: 240px; height: 180px;">
          <svg width="240" height="180" viewBox="0 0 240 180"><rect width="240" height="180"></rect></svg>
        </div>`)
      const bounds = getNodeBoundsFromDOM(container)
      expect(bounds).toEqual({ x: 100, y: 50, width: 240, height: 180 })
    } finally {
      proto.getBBox = original
    }
  })

  it("ignores the PortBand svg when measuring a shaped node", () => {
    const bounds = getNodeBoundsFromDOM(mountViewport(SHAPED_NODE))
    expect(bounds).toEqual({ x: 20, y: 30, width: 200, height: 100 })
  })
})

describe("export palette", () => {
  it("snapshots the light palette while the dark theme is active, then restores it", () => {
    const style = document.createElement("style")
    style.textContent = `
      :root { --besser-background: #ffffff; --besser-primary-contrast: #000000; }
      :root[data-theme="dark"] { --besser-background: #111111; --besser-primary-contrast: #eeeeee; }`
    document.head.appendChild(style)
    document.documentElement.setAttribute("data-theme", "dark")
    document.documentElement.classList.add("dark")

    const palette = snapshotLightPalette()

    expect(palette["--besser-background"]).toBe("#ffffff")
    expect(palette["--besser-primary-contrast"]).toBe("#000000")
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("embeds the palette of the export mount, not the live root, in standalone svgs", () => {
    document.documentElement.style.setProperty("--besser-background", "#111111")
    const container = mountViewport(SHAPED_NODE)
    container.style.setProperty("--besser-background", "#ffffff")
    const svg = getSVG(container, CLIP)
    expect(svg).toContain("--besser-background: #ffffff;")
    document.documentElement.style.removeProperty("--besser-background")
  })
})

describe("inlineSvgImages", () => {
  it("embeds NN layer icons as data URIs (an SVG file or PNG canvas never loads them)", async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Blob(["png"], { type: "image/png" }))
    )
    vi.stubGlobal("fetch", fetchMock)
    try {
      const svg = await inlineSvgImages(
        '<svg><image href="/images/nn-layers/conv2d.png"/><image href="/images/nn-layers/conv2d.png"/></svg>'
      )
      expect(svg).not.toContain('href="/images/')
      expect(svg.match(/href="data:/g)).toHaveLength(2)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
