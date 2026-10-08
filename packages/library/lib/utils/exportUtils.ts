import { IPoint } from "@/edges/types"
import { ReactFlowInstance, type Node, type Edge, Rect } from "@xyflow/react"
import { CSS_VARIABLE_FALLBACKS, LAYOUT, STROKE_COLOR } from "@/constants"
import { Point } from "./pathParsing"

/**
 * Font styles for exported SVGs.
 * Uses the same font stack as the browser (app.css) so the export looks identical
 * when opened in a browser. When opened in applications without Inter installed
 * (e.g. PowerPoint on Windows), the fallback chain provides graceful degradation
 * through system-ui → Avenir → Helvetica → Arial → sans-serif.
 */
const svgFontStyles = `
    text {
      font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
    }
  `

type SvgExportMode = "web" | "compat" | "standalone"

/**
 * Theme-portable SVG export. The "web" mode keeps the
 * raw `var(--besser-*)` references — which is fine for in-browser preview /
 * clipboard, but produces a broken file when downloaded and opened outside
 * a `<html>` host that defines those vars. "standalone" snapshots the
 * current computed values from `document.documentElement` and inlines them
 * in a `<style>` block at the top of the `<svg>`.
 *
 * Variables listed here mirror the set referenced from library components
 * (see `deep-css-dark-mode.md`). New vars added under `--besser-*` should
 * be appended here so they're preserved in standalone exports.
 */
const STANDALONE_PALETTE_VARS = [
  "--besser-primary",
  "--besser-primary-contrast",
  "--besser-secondary",
  "--besser-background",
  "--besser-background-variant",
  "--besser-background-inverse",
  "--besser-gray",
  "--besser-gray-variant",
  "--besser-grid",
  "--besser-interactive-selection",
  "--besser-guide-vertical",
  "--besser-guide-horizontal",
  "--besser-warning-yellow",
  "--besser-text",
  "--besser-text-muted",
  "--besser-gray-700",
  "--besser-sticky-fill",
  "--besser-sticky-stroke",
  "--besser-sticky-text",
] as const

/** Vars read only while rendering (not referenced by the serialized SVG). */
const RENDER_ONLY_PALETTE_VARS = ["--besser-accent-lift", "--besser-error"]

/**
 * The host's LIGHT palette, whatever theme is active: exports are always
 * light (develop parity). In dark mode the root's theme flags are flipped
 * and restored synchronously, so nothing repaints in between.
 */
export function snapshotLightPalette(
  doc: Document = document
): Record<string, string> {
  const root = doc.documentElement
  if (!root || typeof getComputedStyle === "undefined") return {}
  const theme = root.getAttribute("data-theme")
  const hadDarkClass = root.classList.contains("dark")
  const isDark = theme === "dark" || hadDarkClass
  if (isDark) {
    root.setAttribute("data-theme", "light")
    root.classList.remove("dark")
  }
  const palette: Record<string, string> = {}
  try {
    const computed = getComputedStyle(root)
    for (const cssVar of [
      ...STANDALONE_PALETTE_VARS,
      ...RENDER_ONLY_PALETTE_VARS,
    ]) {
      const value = computed.getPropertyValue(cssVar).trim()
      if (value) palette[cssVar] = value
    }
  } finally {
    if (isDark) {
      if (theme === null) root.removeAttribute("data-theme")
      else root.setAttribute("data-theme", theme)
      if (hadDarkClass) root.classList.add("dark")
    }
  }
  if (isDark && palette["--besser-accent-lift"] === undefined) {
    palette["--besser-accent-lift"] = "0%"
  }
  return palette
}

/** Reads the palette in effect on `scope` (the export mount carries the light palette). */
function snapshotStandalonePalette(scope: Element): string {
  if (typeof getComputedStyle === "undefined") return ""
  const computed = getComputedStyle(scope)
  // jsdom does not inherit custom properties; fall back to the root.
  const rootComputed = getComputedStyle(scope.ownerDocument.documentElement)
  const declarations: string[] = []
  for (const cssVar of STANDALONE_PALETTE_VARS) {
    const value =
      computed.getPropertyValue(cssVar).trim() ||
      rootComputed.getPropertyValue(cssVar).trim()
    if (value) {
      declarations.push(`  ${cssVar}: ${value};`)
    }
  }
  if (declarations.length === 0) return ""
  return `:root {\n${declarations.join("\n")}\n}\n`
}

/** UI-only parts of a node that never belong in an export. */
const NODE_UI_SELECTOR =
  ".react-flow__handle, .besser-port-band, .besser-port-anchor, .react-flow__resize-control, [data-export-skip]"

/**
 * The node's body SVG. Not simply the first `<svg>`: shaped nodes render
 * their PortBand (an `<svg>` inside a handle) before the body, and HTML
 * nodes (agent cards) hold icon `<svg>`s that are not the body.
 */
function getNodeBodySvg(node: Element): SVGSVGElement | null {
  for (const svg of Array.from(node.querySelectorAll("svg"))) {
    if (svg.closest(`${NODE_UI_SELECTOR}, [data-export-html]`)) continue
    return svg as SVGSVGElement
  }
  return null
}

const SVG_NS_URI = "http://www.w3.org/2000/svg"
let exportClipCounter = 0

/** Computed CSS color -> SVG paint; `null` when fully transparent. */
function toSvgPaint(color: string | null | undefined): string | null {
  const value = (color ?? "").trim()
  if (!value || value === "transparent" || value === "none") return null
  // color-mix() computes to `color(srgb r g b / a)`, unknown to most SVG tools.
  const srgb = value.match(
    /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+%?))?\)$/
  )
  if (srgb) {
    const [r, g, b] = srgb.slice(1, 4).map((v) => Math.round(Number(v) * 255))
    const a = srgb[4]
      ? srgb[4].endsWith("%")
        ? Number(srgb[4].slice(0, -1)) / 100
        : Number(srgb[4])
      : 1
    if (a === 0) return null
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`
  }
  if (/^rgba\(.*,\s*0\)$/.test(value)) return null
  return value
}

let measureCtx: CanvasRenderingContext2D | null | undefined
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    try {
      measureCtx = document.createElement("canvas").getContext("2d")
    } catch {
      measureCtx = null
    }
  }
  return measureCtx
}

/** Frame mapping client (screen) px into the target SVG's user units. */
type ExportFrame = { left: number; top: number; scale: number }

function applyTextTransform(text: string, transform: string): string {
  if (transform === "uppercase") return text.toUpperCase()
  if (transform === "lowercase") return text.toLowerCase()
  if (transform === "capitalize")
    return text.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
  return text
}

/** Splits a text node into its rendered lines (one client rect each). */
function getTextLines(
  textNode: Text
): { text: string; rect: DOMRect }[] {
  const text = textNode.data
  const range = document.createRange()
  range.selectNodeContents(textNode)
  const rects = Array.from(range.getClientRects()).filter(
    (r) => r.width > 0 || r.height > 0
  )
  if (rects.length === 0) return []
  if (rects.length === 1) return [{ text, rect: rects[0] }]
  const lines: { text: string; rect: DOMRect }[] = []
  let current: { start: number; top: number; rect: DOMRect } | null = null
  for (let i = 0; i < text.length; i++) {
    range.setStart(textNode, i)
    range.setEnd(textNode, i + 1)
    const r = range.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (!current || Math.abs(r.top - current.top) > r.height / 2) {
      if (current) {
        lines.push({ text: text.slice(current.start, i), rect: current.rect })
      }
      current = { start: i, top: r.top, rect: r }
    } else {
      const left = Math.min(current.rect.left, r.left)
      const right = Math.max(current.rect.right, r.right)
      current.rect = new DOMRect(left, current.rect.top, right - left, current.rect.height)
    }
  }
  if (current) lines.push({ text: text.slice(current.start), rect: current.rect })
  return lines
}

/** Nearest ancestor (up to `stop`) that clips its overflow. */
function getClippingAncestor(el: Element, stop: Element): Element | null {
  let cur: Element | null = el
  while (cur && cur !== stop.parentElement) {
    if (getComputedStyle(cur).overflowX !== "visible") return cur
    cur = cur.parentElement
  }
  return null
}

function emitTextNode(
  textNode: Text,
  parent: Element,
  root: Element,
  frame: ExportFrame,
  out: Element
): void {
  const cs = getComputedStyle(parent)
  const preserve = cs.whiteSpace.startsWith("pre")
  if (!preserve && !textNode.data.trim()) return
  const fill = toSvgPaint(cs.color) ?? STROKE_COLOR
  const fontSize = parseFloat(cs.fontSize) || 16
  const ctx = getMeasureContext()
  const font = `${cs.fontStyle} ${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`
  let ascent = fontSize * 0.8
  let descent = fontSize * 0.2
  if (ctx) {
    ctx.font = font
    const m = ctx.measureText("Hg")
    if (m.fontBoundingBoxAscent) {
      ascent = m.fontBoundingBoxAscent
      descent = m.fontBoundingBoxDescent
    }
  }
  const clipEl = preserve ? null : getClippingAncestor(parent, root)
  const clipRight = clipEl
    ? clipEl.getBoundingClientRect().right -
      parseFloat(getComputedStyle(clipEl).paddingRight || "0")
    : Infinity

  for (const line of getTextLines(textNode)) {
    let content = applyTextTransform(
      preserve ? line.text.replace(/\n$/, "") : line.text.trim(),
      cs.textTransform
    )
    if (!content.trim() && !preserve) continue
    // Clipped text gets an ellipsis, as on the canvas.
    if (line.rect.right > clipRight + 0.5 && ctx) {
      const availCss = (clipRight - line.rect.left) * frame.scale
      while (
        content.length > 1 &&
        ctx.measureText(`${content}…`).width > availCss
      ) {
        content = content.slice(0, -1)
      }
      content = `${content.trimEnd()}…`
    }
    // The line rect spans the font's content area (ascent + descent).
    const baseline =
      line.rect.top + ascent * (line.rect.height / Math.max(ascent + descent, 1))
    const t = document.createElementNS(SVG_NS_URI, "text")
    t.setAttribute("x", `${(line.rect.left - frame.left) * frame.scale}`)
    t.setAttribute("y", `${(baseline - frame.top) * frame.scale}`)
    t.setAttribute("font-size", `${fontSize}px`)
    // Inline style: the export's `text { font-family }` rule beats an attribute.
    const fontFamily = `font-family: ${cs.fontFamily.replace(/"/g, "'")}`
    t.setAttribute("font-weight", cs.fontWeight)
    if (cs.fontStyle !== "normal") t.setAttribute("font-style", cs.fontStyle)
    if (cs.textDecorationLine && cs.textDecorationLine !== "none") {
      t.setAttribute("text-decoration", cs.textDecorationLine)
    }
    if (parseFloat(cs.letterSpacing)) {
      t.setAttribute("letter-spacing", `${parseFloat(cs.letterSpacing)}`)
    }
    t.setAttribute("fill", fill)
    t.setAttribute("style", preserve ? `${fontFamily}; white-space: pre` : fontFamily)
    if (preserve) t.setAttribute("xml:space", "preserve")
    t.textContent = content
    out.appendChild(t)
  }
}

/**
 * Serializes laid-out HTML (an agent card, a foreignObject body) into plain
 * SVG shapes and text, so the export needs no foreignObject: a foreignObject
 * in the SVG taints the canvas and breaks PNG export.
 */
function serializeHtmlToSvg(
  root: Element,
  frame: ExportFrame,
  out: Element
): void {
  const walk = (el: Element, target: Element) => {
    if (el.matches(NODE_UI_SELECTOR)) return
    if (el.namespaceURI === SVG_NS_URI) {
      if (el.tagName.toLowerCase() !== "svg") return
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      const clone = el.cloneNode(true) as Element
      clone.setAttribute("x", `${(r.left - frame.left) * frame.scale}`)
      clone.setAttribute("y", `${(r.top - frame.top) * frame.scale}`)
      clone.setAttribute("width", `${r.width * frame.scale}`)
      clone.setAttribute("height", `${r.height * frame.scale}`)
      clone.removeAttribute("class")
      const color = toSvgPaint(getComputedStyle(el).color)
      if (color) clone.setAttribute("color", color)
      target.appendChild(clone)
      return
    }
    const cs = getComputedStyle(el)
    if (cs.display === "none" || cs.visibility === "hidden") return
    const r = el.getBoundingClientRect()
    const x = (r.left - frame.left) * frame.scale
    const y = (r.top - frame.top) * frame.scale
    const w = r.width * frame.scale
    const h = r.height * frame.scale

    const bg = toSvgPaint(cs.backgroundColor)
    const borderWidth = parseFloat(cs.borderTopWidth) || 0
    const borderPaint =
      borderWidth > 0 && cs.borderTopStyle !== "none"
        ? toSvgPaint(cs.borderTopColor)
        : null
    const radius = (parseFloat(cs.borderTopLeftRadius) || 0) * frame.scale
    const uniformBorder =
      cs.borderTopWidth === cs.borderBottomWidth &&
      cs.borderTopWidth === cs.borderLeftWidth &&
      cs.borderTopWidth === cs.borderRightWidth
    if ((bg || (borderPaint && uniformBorder)) && w > 0 && h > 0) {
      const rect = document.createElementNS(SVG_NS_URI, "rect")
      const inset = borderPaint && uniformBorder ? (borderWidth * frame.scale) / 2 : 0
      rect.setAttribute("x", `${x + inset}`)
      rect.setAttribute("y", `${y + inset}`)
      rect.setAttribute("width", `${Math.max(0, w - inset * 2)}`)
      rect.setAttribute("height", `${Math.max(0, h - inset * 2)}`)
      if (radius) {
        rect.setAttribute("rx", `${radius}`)
        rect.setAttribute("ry", `${radius}`)
      }
      rect.setAttribute("fill", bg ?? "none")
      if (borderPaint && uniformBorder) {
        rect.setAttribute("stroke", borderPaint)
        rect.setAttribute("stroke-width", `${borderWidth * frame.scale}`)
        if (cs.borderTopStyle === "dashed") {
          rect.setAttribute("stroke-dasharray", `${4 * frame.scale} ${3 * frame.scale}`)
        }
      }
      target.appendChild(rect)
    }
    // Single-side borders (dividers): draw them as lines.
    if (!uniformBorder) {
      ;(["Top", "Right", "Bottom", "Left"] as const).forEach((side) => {
        const bw = parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`)) || 0
        const paint = toSvgPaint(cs.getPropertyValue(`border-${side.toLowerCase()}-color`))
        if (!bw || !paint || cs.getPropertyValue(`border-${side.toLowerCase()}-style`) === "none") return
        const half = (bw * frame.scale) / 2
        const line = document.createElementNS(SVG_NS_URI, "line")
        const [x1, y1, x2, y2] =
          side === "Top" ? [x, y + half, x + w, y + half]
          : side === "Bottom" ? [x, y + h - half, x + w, y + h - half]
          : side === "Left" ? [x + half, y, x + half, y + h]
          : [x + w - half, y, x + w - half, y + h]
        line.setAttribute("x1", `${x1}`)
        line.setAttribute("y1", `${y1}`)
        line.setAttribute("x2", `${x2}`)
        line.setAttribute("y2", `${y2}`)
        line.setAttribute("stroke", paint)
        line.setAttribute("stroke-width", `${bw * frame.scale}`)
        target.appendChild(line)
      })
    }

    // Clip children only where content actually overflows a clipping box.
    let childTarget = target
    const overflows =
      cs.overflowX !== "visible" &&
      ((el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight + 1 ||
        (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth + 1)
    if (overflows && w > 0 && h > 0) {
      const id = `besser-export-clip-${++exportClipCounter}`
      const clipPath = document.createElementNS(SVG_NS_URI, "clipPath")
      clipPath.setAttribute("id", id)
      const clipRect = document.createElementNS(SVG_NS_URI, "rect")
      clipRect.setAttribute("x", `${x}`)
      clipRect.setAttribute("y", `${y}`)
      clipRect.setAttribute("width", `${w}`)
      clipRect.setAttribute("height", `${h}`)
      if (radius) clipRect.setAttribute("rx", `${radius}`)
      clipPath.appendChild(clipRect)
      target.appendChild(clipPath)
      const g = document.createElementNS(SVG_NS_URI, "g")
      g.setAttribute("clip-path", `url(#${id})`)
      target.appendChild(g)
      childTarget = g
    }

    el.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        emitTextNode(child as Text, el, root, frame, childTarget)
      } else if (child.nodeType === 1) {
        walk(child as Element, childTarget)
      }
    })
  }
  walk(root, out)
}

/**
 * No layout (headless jsdom): keep the text, stacked one leaf per line, so
 * a server-side render still carries names and bodies.
 */
function serializeHtmlTextFallback(
  root: Element,
  width: number,
  out: Element,
  height = 0
): void {
  const lines: string[] = []
  const collect = (el: Element) => {
    if (el.matches(NODE_UI_SELECTOR) || el.namespaceURI === SVG_NS_URI) return
    let own = ""
    el.childNodes.forEach((child) => {
      if (child.nodeType === 3) own += (child as Text).data
      else if (child.nodeType === 1) {
        if (own.trim()) lines.push(own.trim())
        own = ""
        collect(child as Element)
      }
    })
    if (own.trim()) lines.push(own.trim())
  }
  collect(root)
  if (width > 0) {
    const frame = document.createElementNS(SVG_NS_URI, "rect")
    frame.setAttribute("x", "0.5")
    frame.setAttribute("y", "0.5")
    frame.setAttribute("width", `${width - 1}`)
    frame.setAttribute("height", `${Math.max(height - 1, lines.length * 16 + 12)}`)
    frame.setAttribute("rx", "8")
    frame.setAttribute("fill", "var(--besser-background, #ffffff)")
    frame.setAttribute("stroke", "var(--besser-gray-variant, #495057)")
    out.appendChild(frame)
  }
  lines.forEach((line, i) => {
    const t = document.createElementNS(SVG_NS_URI, "text")
    t.setAttribute("x", "8")
    t.setAttribute("y", `${20 + i * 16}`)
    t.setAttribute("font-size", "12px")
    t.setAttribute("fill", "var(--besser-primary-contrast, #000000)")
    t.textContent = line
    out.appendChild(t)
  })
}

/** HTML node content (an agent card) as SVG, placed in node-local units. */
function serializeHtmlNode(
  node: HTMLElement,
  htmlRoot: Element,
  out: Element
): void {
  const nodeRect = node.getBoundingClientRect()
  if (!(nodeRect.width > 0) || !node.offsetWidth) {
    serializeHtmlTextFallback(htmlRoot, node.offsetWidth, out, node.offsetHeight)
    return
  }
  serializeHtmlToSvg(
    htmlRoot,
    {
      left: nodeRect.left,
      top: nodeRect.top,
      scale: node.offsetWidth / nodeRect.width,
    },
    out
  )
}

/**
 * Replaces each foreignObject of `clone` (a copy of `live`) with SVG text
 * and shapes measured from the live one.
 */
function replaceForeignObjects(live: Element, clone: Element): void {
  // By tag, not selector: selector case handling for SVG names varies.
  const liveFOs = Array.from(live.getElementsByTagNameNS(SVG_NS_URI, "foreignObject"))
  const cloneFOs = Array.from(clone.getElementsByTagNameNS(SVG_NS_URI, "foreignObject"))
  if (liveFOs.length !== cloneFOs.length) return
  liveFOs.forEach((fo, i) => {
    const g = document.createElementNS(SVG_NS_URI, "g")
    const x = parseFloat(fo.getAttribute("x") ?? "0") || 0
    const y = parseFloat(fo.getAttribute("y") ?? "0") || 0
    const width = parseFloat(fo.getAttribute("width") ?? "0") || 0
    g.setAttribute("transform", `translate(${x}, ${y})`)
    const rect = fo.getBoundingClientRect()
    const content = fo.firstElementChild
    if (content) {
      if (rect.width > 0 && width > 0) {
        serializeHtmlToSvg(
          content,
          { left: rect.left, top: rect.top, scale: width / rect.width },
          g
        )
      } else {
        serializeHtmlTextFallback(content, 0, g)
      }
    }
    cloneFOs[i].replaceWith(g)
  })
}

type ExportFilterOptions = {
  include?: string[]
  exclude?: string[]
  svgMode?: SvgExportMode
}

function shouldRenderElement(
  elementId: string | null,
  options?: ExportFilterOptions
): boolean {
  if (!elementId) {
    return true
  }

  if (options?.include && options.include.length > 0) {
    return options.include.includes(elementId)
  }

  if (options?.exclude && options.exclude.length > 0) {
    return !options.exclude.includes(elementId)
  }

  return true
}

export function filterRenderedElements(
  container: HTMLElement,
  options?: ExportFilterOptions
): void {
  if (!options?.include?.length && !options?.exclude?.length) {
    return
  }

  container
    .querySelectorAll(".react-flow__node, .react-flow__edge")
    .forEach((element) => {
      const elementId = element.getAttribute("data-id") || element.id || null
      if (!shouldRenderElement(elementId, options)) {
        element.remove()
      }
    })
}

export const getSVG = (
  container: HTMLElement,
  clip: Rect,
  options?: ExportFilterOptions
): string => {
  const emptySVG = "<svg></svg>"

  const width = clip.width
  const height = clip.height

  // Default downloaded SVGs to "standalone" so the
  // file is portable when opened outside the host page. Hosts that need the
  // raw CSS-var output for in-browser preview / clipboard can still pass
  // `svgMode: "web"` explicitly.
  const svgMode = options?.svgMode ?? "standalone"
  const vp = container.querySelector(".react-flow__viewport")

  if (!vp) return emptySVG

  const SVG_NS = "http://www.w3.org/2000/svg"
  const mainSVG = document.createElementNS(SVG_NS, "svg")
  mainSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  const styleEl = document.createElementNS(SVG_NS, "style")
  // In web mode, keep CSS variables unresolved so the host app theme can drive
  // light/dark colors. Compat mode resolves variables to static values below.
  // Standalone mode prepends a snapshot of the current `--besser-*` palette so
  // the downloaded file resolves correctly when opened outside the host page.
  if (svgMode === "standalone") {
    const paletteRule = snapshotStandalonePalette(container)
    styleEl.textContent = `${paletteRule}${svgFontStyles}`
  } else {
    styleEl.textContent = svgFontStyles
  }
  mainSVG.appendChild(styleEl)
  mainSVG.setAttribute("viewBox", `${clip.x} ${clip.y} ${width} ${height}`)
  mainSVG.setAttribute("width", `${width}`)
  mainSVG.setAttribute("height", `${height}`)
  // Use geometric precision for anti-aliasing to reduce visual artifacts
  // where edges overlap with node borders in non-browser renderers (resvg, Inkscape)
  mainSVG.setAttribute("shape-rendering", "geometricPrecision")

  const MainNodesGTag = document.createElementNS(SVG_NS, "g")
  mainSVG.appendChild(MainNodesGTag)
  const allNodes = vp.querySelectorAll(".react-flow__node")

  allNodes.forEach((node) => {
    const styles = extractStyles(node.getAttribute("style") ?? "")
    const newGTagForNode = document.createElementNS(SVG_NS, "g")
    const htmlRoot = node.querySelector("[data-export-html]")
    const svgElement = htmlRoot ? null : getNodeBodySvg(node)

    newGTagForNode.setAttribute(
      "transform",
      `translate(${styles.transform.x}, ${styles.transform.y})`
    )
    if (htmlRoot) {
      serializeHtmlNode(node as HTMLElement, htmlRoot, newGTagForNode)
    } else if (svgElement) {
      // Clone the SVG to avoid removing it from the live DOM
      const clonedSvg = svgElement.cloneNode(true) as Element
      replaceForeignObjects(svgElement, clonedSvg)
      // Remove handles from the clone (they're UI-only connection points)
      clonedSvg
        .querySelectorAll(".react-flow__handle")
        ?.forEach((el) => el.remove())
      newGTagForNode.appendChild(clonedSvg)
    }
    MainNodesGTag.appendChild(newGTagForNode)
  })

  // Get all edge elements
  const allEdgeElements = vp.querySelectorAll(".react-flow__edge")

  const MainEdgesGTag = document.createElementNS(SVG_NS, "g")
  mainSVG.appendChild(MainEdgesGTag)

  // UI-only classes to skip (not part of the actual diagram)
  const uiOnlyClasses = [
    "edge-circle",
    "edge-overlay",
    "edge-container", // Container wraps paths, we want the paths not the container
    "react-flow__edge-interaction",
    "react-flow__edgeupdater",
    "react-flow__edgeupdater-source",
    "react-flow__edgeupdater-target",
    "target-edge-marker-grab",
  ]

  // Add edge paths, inline markers, and text labels (clone to avoid modifying live DOM)
  allEdgeElements.forEach((edgeContainer) => {
    // Only get direct paths with the edge-path class (the actual visible edge)
    const edgePaths = edgeContainer.querySelectorAll(".react-flow__edge-path")
    edgePaths.forEach((path) => {
      const clonedPath = path.cloneNode(true) as Element

      // Ensure explicit stroke-width for PowerPoint (default to LINE_WIDTH_EDGE if not set)
      if (!clonedPath.getAttribute("stroke-width")) {
        clonedPath.setAttribute("stroke-width", String(LAYOUT.LINE_WIDTH_EDGE))
      }

      // Ensure explicit stroke color for edge visibility
      // The stroke may be set via CSS style that gets lost during export
      if (!clonedPath.getAttribute("stroke")) {
        // Check if there's an inline style with stroke
        const styleAttr = clonedPath.getAttribute("style") || ""
        const strokeMatch = styleAttr.match(/stroke:\s*([^;]+)/)
        if (strokeMatch) {
          clonedPath.setAttribute("stroke", strokeMatch[1].trim())
        } else {
          // Default to the primary contrast color (black)
          clonedPath.setAttribute("stroke", STROKE_COLOR)
        }
      }

      // Ensure explicit fill for paths (PowerPoint may not default to none)
      if (!clonedPath.getAttribute("fill")) {
        clonedPath.setAttribute("fill", "none")
      }

      // Ensure fully opaque rendering for non-browser SVG renderers (resvg, Inkscape, etc.)
      // Without explicit opacity attributes, some renderers may not default to 1.0,
      // causing overlapping edges/borders to appear darker due to alpha compositing.
      clonedPath.setAttribute("opacity", "1")
      clonedPath.setAttribute("stroke-opacity", "1")

      MainEdgesGTag.appendChild(clonedPath)
    })

    // Inline marker shapes (drawn instead of <marker> defs)
    const inlineMarkers = edgeContainer.querySelectorAll("[data-inline-marker]")
    inlineMarkers.forEach((marker) => {
      MainEdgesGTag.appendChild(marker.cloneNode(true))
    })

    // Get label groups first (for complex edge labels like CommunicationDiagram messages)
    const labelGroups = edgeContainer.querySelectorAll(
      ".react-flow__edge-text, .react-flow__edge-textwrapper, .edge-labels"
    )
    labelGroups.forEach((group) => {
      const cloned = group.cloneNode(true) as Element
      // Remove any UI elements that might be nested
      uiOnlyClasses.forEach((cls) => {
        cloned.querySelectorAll?.(`.${cls}`)?.forEach((el) => el.remove())
      })
      MainEdgesGTag.appendChild(cloned)
    })

    // Get standalone text labels (not already inside label groups to avoid duplication)
    const textElements = edgeContainer.querySelectorAll("text")
    textElements.forEach((text) => {
      // Check if this text is inside a label group
      const isInsideLabelGroup = Array.from(labelGroups).some((group) =>
        group.contains(text)
      )

      if (!isInsideLabelGroup) {
        MainEdgesGTag.appendChild(text.cloneNode(true))
      }
    })
  })

  // Process the SVG for compatibility with non-browser renderers
  if (svgMode === "compat") {
    replaceCSSVariables(mainSVG)
    convertStyleToAttributes(mainSVG)
    ensureTextFontDefaults(mainSVG)
    removeMarkerElements(mainSVG)
    replaceTextDecorationWithManualUnderline(mainSVG)
  }

  if (svgMode === "standalone") {
    // Standalone files need an XML prolog so they're recognized as standalone
    // SVG documents by external tooling. The `<style>` block embedded above
    // already carries the resolved palette snapshot.
    return `<?xml version="1.0" encoding="UTF-8"?>\n${mainSVG.outerHTML}`
  }

  return mainSVG.outerHTML
}

/**
 * Embeds `<image href>` files (NN layer icons) as data URIs: an SVG opened
 * as a file or drawn to a PNG canvas never loads external images. Images
 * that cannot be fetched (headless render) keep their href.
 */
export async function inlineSvgImages(svg: string): Promise<string> {
  const hrefs = Array.from(
    new Set(
      Array.from(svg.matchAll(/<image\b[^>]*?\bhref="([^"]+)"/g), (m) => m[1])
    )
  ).filter((href) => !href.startsWith("data:"))
  if (hrefs.length === 0 || typeof fetch === "undefined") return svg
  const inlined = await Promise.all(
    hrefs.map(async (href) => {
      try {
        const response = await fetch(new URL(href, document.baseURI).href)
        if (!response.ok) return null
        const blob = await response.blob()
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(blob)
        })
      } catch {
        return null
      }
    })
  )
  let result = svg
  hrefs.forEach((href, i) => {
    const dataUri = inlined[i]
    if (dataUri) result = result.split(`href="${href}"`).join(`href="${dataUri}"`)
  })
  return result
}

/**
 * Extract all coordinate points from an SVG path string.
 * This includes endpoints AND control points for bezier curves,
 * which is important because bezier curves are bounded by the
 * convex hull of all their control points.
 *
 * For S (smooth cubic) and T (smooth quadratic) commands, we also
 * include the reflected control point which may extend the bounds.
 */
function extractPathPoints(pathD: string): Point[] {
  if (!pathD) return []

  const points: Point[] = []
  // Tokenize commands to track current position for relative coords
  const commands =
    pathD.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) ?? []

  let currentX = 0
  let currentY = 0
  // Track last control point for S and T commands
  let lastControlX = 0
  let lastControlY = 0
  let lastCommandType = ""

  for (const cmd of commands) {
    const type = cmd[0]
    const isRelative = type === type.toLowerCase()
    const absType = type.toUpperCase()
    const params =
      cmd
        .slice(1)
        .match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)
        ?.map(Number) ?? []

    switch (absType) {
      case "M": // MoveTo
      case "L": // LineTo
        for (let i = 0; i + 1 < params.length; i += 2) {
          if (isRelative) {
            currentX += params[i]
            currentY += params[i + 1]
          } else {
            currentX = params[i]
            currentY = params[i + 1]
          }
          points.push({ x: currentX, y: currentY })
        }
        // Reset control point tracking for non-curve commands
        lastControlX = currentX
        lastControlY = currentY
        break

      case "H": // Horizontal LineTo
        for (const x of params) {
          currentX = isRelative ? currentX + x : x
          points.push({ x: currentX, y: currentY })
        }
        lastControlX = currentX
        lastControlY = currentY
        break

      case "V": // Vertical LineTo
        for (const y of params) {
          currentY = isRelative ? currentY + y : y
          points.push({ x: currentX, y: currentY })
        }
        lastControlX = currentX
        lastControlY = currentY
        break

      case "C": // Cubic Bezier (x1 y1 x2 y2 x y)
        // Include ALL control points - curve is bounded by convex hull
        for (let i = 0; i + 5 < params.length; i += 6) {
          const cp1x = isRelative ? currentX + params[i] : params[i]
          const cp1y = isRelative ? currentY + params[i + 1] : params[i + 1]
          const cp2x = isRelative ? currentX + params[i + 2] : params[i + 2]
          const cp2y = isRelative ? currentY + params[i + 3] : params[i + 3]
          const endX = isRelative ? currentX + params[i + 4] : params[i + 4]
          const endY = isRelative ? currentY + params[i + 5] : params[i + 5]

          points.push({ x: cp1x, y: cp1y })
          points.push({ x: cp2x, y: cp2y })
          points.push({ x: endX, y: endY })

          // Track last control point for potential S command
          lastControlX = cp2x
          lastControlY = cp2y
          currentX = endX
          currentY = endY
        }
        break

      case "S": // Smooth Cubic Bezier (x2 y2 x y)
        // S command uses reflected control point from previous C or S
        for (let i = 0; i + 3 < params.length; i += 4) {
          // Calculate reflected control point (cp1)
          // If previous command was C or S, reflect the last control point
          // Otherwise, cp1 equals current point
          let cp1x: number, cp1y: number
          if (lastCommandType === "C" || lastCommandType === "S") {
            cp1x = 2 * currentX - lastControlX
            cp1y = 2 * currentY - lastControlY
          } else {
            cp1x = currentX
            cp1y = currentY
          }

          const cp2x = isRelative ? currentX + params[i] : params[i]
          const cp2y = isRelative ? currentY + params[i + 1] : params[i + 1]
          const endX = isRelative ? currentX + params[i + 2] : params[i + 2]
          const endY = isRelative ? currentY + params[i + 3] : params[i + 3]

          // Include reflected control point in bounds
          points.push({ x: cp1x, y: cp1y })
          points.push({ x: cp2x, y: cp2y })
          points.push({ x: endX, y: endY })

          lastControlX = cp2x
          lastControlY = cp2y
          currentX = endX
          currentY = endY
        }
        break

      case "Q": // Quadratic Bezier (x1 y1 x y)
        for (let i = 0; i + 3 < params.length; i += 4) {
          const cpx = isRelative ? currentX + params[i] : params[i]
          const cpy = isRelative ? currentY + params[i + 1] : params[i + 1]
          const endX = isRelative ? currentX + params[i + 2] : params[i + 2]
          const endY = isRelative ? currentY + params[i + 3] : params[i + 3]

          points.push({ x: cpx, y: cpy })
          points.push({ x: endX, y: endY })

          lastControlX = cpx
          lastControlY = cpy
          currentX = endX
          currentY = endY
        }
        break

      case "T": // Smooth Quadratic (x y)
        // T command uses reflected control point from previous Q or T
        for (let i = 0; i + 1 < params.length; i += 2) {
          // Calculate reflected control point
          let cpx: number, cpy: number
          if (lastCommandType === "Q" || lastCommandType === "T") {
            cpx = 2 * currentX - lastControlX
            cpy = 2 * currentY - lastControlY
          } else {
            cpx = currentX
            cpy = currentY
          }

          const endX = isRelative ? currentX + params[i] : params[i]
          const endY = isRelative ? currentY + params[i + 1] : params[i + 1]

          // Include reflected control point in bounds
          points.push({ x: cpx, y: cpy })
          points.push({ x: endX, y: endY })

          lastControlX = cpx
          lastControlY = cpy
          currentX = endX
          currentY = endY
        }
        break

      case "A": // Arc (rx ry x-axis-rotation large-arc sweep x y)
        // For arcs, we include endpoints and add arc extrema estimation
        for (let i = 0; i + 6 < params.length; i += 7) {
          const rx = params[i]
          const ry = params[i + 1]
          const endX = isRelative ? currentX + params[i + 5] : params[i + 5]
          const endY = isRelative ? currentY + params[i + 6] : params[i + 6]

          // Include endpoint
          points.push({ x: endX, y: endY })

          // Conservative bounds: include points that represent potential arc extrema
          // Arc can extend up to rx/ry beyond the chord between start and end
          const midX = (currentX + endX) / 2
          const midY = (currentY + endY) / 2
          // Add potential extrema points (conservative estimate)
          points.push({ x: midX - rx, y: midY })
          points.push({ x: midX + rx, y: midY })
          points.push({ x: midX, y: midY - ry })
          points.push({ x: midX, y: midY + ry })

          currentX = endX
          currentY = endY
        }
        lastControlX = currentX
        lastControlY = currentY
        break

      case "Z": // Close path
        // Z doesn't add points, just closes to start
        lastControlX = currentX
        lastControlY = currentY
        break
    }

    lastCommandType = absType
  }

  return points
}

/**
 * Get bounding box from edge data points.
 * Falls back to stored points if available.
 */
function getBoundingBox(edges: Edge[], nodes: Node[]) {
  const allPoints: IPoint[] = edges.flatMap(
    (edge) => (edge.data?.points as IPoint[]) ?? []
  )

  if (allPoints.length === 0) {
    return undefined // No points to calculate bounds
  }

  // Create a map for quick node lookup
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))

  // Add source and target positions for each edge to ensure we capture connection points
  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)

    if (sourceNode && sourceNode.position) {
      allPoints.push({ x: sourceNode.position.x, y: sourceNode.position.y })
      if (sourceNode.width && sourceNode.height) {
        // Add corners of source node to ensure complete coverage
        allPoints.push({
          x: sourceNode.position.x + sourceNode.width,
          y: sourceNode.position.y + sourceNode.height,
        })
      }
    }

    if (targetNode && targetNode.position) {
      allPoints.push({ x: targetNode.position.x, y: targetNode.position.y })
      if (targetNode.width && targetNode.height) {
        // Add corners of target node to ensure complete coverage
        allPoints.push({
          x: targetNode.position.x + targetNode.width,
          y: targetNode.position.y + targetNode.height,
        })
      }
    }
  })

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const p of allPoints) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function getNodeBoundsFromDOM(
  container: HTMLElement,
  reactFlow?: ReactFlowInstance<Node, Edge>
): Rect | undefined {
  const nodeElements = container.querySelectorAll(".react-flow__node")

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let foundNode = false

  nodeElements.forEach((nodeEl) => {
    const styleStr = nodeEl.getAttribute("style") ?? ""
    const styles = extractStyles(styleStr)
    const svgElement = nodeEl.querySelector("[data-export-html]")
      ? null
      : getNodeBodySvg(nodeEl)
    const measuredEl = svgElement ?? nodeEl
    // jsdom (the headless server render) has no layout: every rect is 0x0.
    const measuredRect = measuredEl.getBoundingClientRect()
    const renderedSvgRect =
      measuredRect.width > 0 || measuredRect.height > 0
        ? measuredRect
        : undefined
    if (svgElement) {
      const viewBox = svgElement.getAttribute("viewBox")
      if (viewBox) {
        const viewBoxParts = viewBox.split(/[\s,]+/).map(Number)
        if (viewBoxParts.length >= 4) {
          const [vbX, vbY, vbW, vbH] = viewBoxParts
          const svgWidth =
            renderedSvgRect?.width ??
            parseFloat(svgElement.getAttribute("width") ?? `${vbW}`)
          const svgHeight =
            renderedSvgRect?.height ??
            parseFloat(svgElement.getAttribute("height") ?? `${vbH}`)

          if (
            Number.isFinite(svgWidth) &&
            Number.isFinite(svgHeight) &&
            vbW !== 0 &&
            vbH !== 0
          ) {
            try {
              const bbox = (svgElement as SVGGraphicsElement).getBBox()
              if (
                Number.isFinite(bbox.x) &&
                Number.isFinite(bbox.y) &&
                Number.isFinite(bbox.width) &&
                Number.isFinite(bbox.height) &&
                (bbox.width > 0 || bbox.height > 0)
              ) {
                const scaleX = svgWidth / vbW
                const scaleY = svgHeight / vbH
                const bboxX = styles.transform.x + (bbox.x - vbX) * scaleX
                const bboxY = styles.transform.y + (bbox.y - vbY) * scaleY
                const bboxMaxX =
                  styles.transform.x + (bbox.x + bbox.width - vbX) * scaleX
                const bboxMaxY =
                  styles.transform.y + (bbox.y + bbox.height - vbY) * scaleY

                // The node's own viewport box always counts: getBBox can
                // under-report (jsdom shims it to 10x10).
                foundNode = true
                minX = Math.min(minX, bboxX, styles.transform.x)
                minY = Math.min(minY, bboxY, styles.transform.y)
                maxX = Math.max(maxX, bboxMaxX, styles.transform.x + svgWidth)
                maxY = Math.max(maxY, bboxMaxY, styles.transform.y + svgHeight)
                return
              }
            } catch {
              // Fall back to screen-rect or wrapper-based bounds when getBBox()
              // is unavailable in the current renderer.
            }
          }
        }
      }
    }

    if (renderedSvgRect && reactFlow) {
      const topLeft = reactFlow.screenToFlowPosition({
        x: renderedSvgRect.left,
        y: renderedSvgRect.top,
      })
      const bottomRight = reactFlow.screenToFlowPosition({
        x: renderedSvgRect.right,
        y: renderedSvgRect.bottom,
      })

      if (
        Number.isFinite(topLeft.x) &&
        Number.isFinite(topLeft.y) &&
        Number.isFinite(bottomRight.x) &&
        Number.isFinite(bottomRight.y)
      ) {
        foundNode = true
        minX = Math.min(minX, topLeft.x)
        minY = Math.min(minY, topLeft.y)
        maxX = Math.max(maxX, bottomRight.x)
        maxY = Math.max(maxY, bottomRight.y)
        return
      }
    }

    const width = renderedSvgRect?.width ?? parseFloat(styles.width ?? "")
    const height = renderedSvgRect?.height ?? parseFloat(styles.height ?? "")

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return
    }

    foundNode = true
    minX = Math.min(minX, styles.transform.x)
    minY = Math.min(minY, styles.transform.y)
    maxX = Math.max(maxX, styles.transform.x + width)
    maxY = Math.max(maxY, styles.transform.y + height)
  })

  if (!foundNode) {
    return undefined
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Calculate bounding box from actual rendered edge paths in the DOM.
 * This accounts for:
 * - Bezier curve control points that may extend beyond waypoints
 * - Circle markers (which use <circle> elements, not <path>)
 * - Stroke width that extends beyond the mathematical path
 */
function getEdgeBoundsFromDOM(container: HTMLElement): Rect | undefined {
  const edgePaths = container.querySelectorAll(".react-flow__edge-path")
  const allPoints: Point[] = []
  let maxStrokeWidth = 0

  edgePaths.forEach((path) => {
    const d = path.getAttribute("d")
    if (d) {
      allPoints.push(...extractPathPoints(d))
    }
    // Track stroke width for bounds expansion
    const strokeWidth = parseFloat(
      path.getAttribute("stroke-width") ?? String(LAYOUT.LINE_WIDTH_EDGE)
    )
    if (strokeWidth > maxStrokeWidth) {
      maxStrokeWidth = strokeWidth
    }
  })

  // Check inline markers - both path and circle elements
  const markers = container.querySelectorAll("[data-inline-marker]")
  markers.forEach((marker) => {
    const tagName = marker.tagName.toLowerCase()

    if (tagName === "path") {
      const d = marker.getAttribute("d")
      if (d) {
        allPoints.push(...extractPathPoints(d))
      }
    } else if (tagName === "circle") {
      // Handle circle markers (used for BPMN diagrams)
      const cx = parseFloat(marker.getAttribute("cx") ?? "0")
      const cy = parseFloat(marker.getAttribute("cy") ?? "0")
      const r = parseFloat(marker.getAttribute("r") ?? "0")
      const strokeWidth = parseFloat(marker.getAttribute("stroke-width") ?? "0")
      const totalRadius = r + strokeWidth / 2

      // Add bounding box corners for the circle
      allPoints.push({ x: cx - totalRadius, y: cy - totalRadius })
      allPoints.push({ x: cx + totalRadius, y: cy + totalRadius })
    }

    // Track marker stroke width
    const strokeWidth = parseFloat(marker.getAttribute("stroke-width") ?? "0")
    if (strokeWidth > maxStrokeWidth) {
      maxStrokeWidth = strokeWidth
    }
  })

  if (allPoints.length === 0) {
    return undefined
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const p of allPoints) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  // Expand bounds by half stroke width (stroke is centered on path)
  const strokeExpansion = maxStrokeWidth / 2
  minX -= strokeExpansion
  minY -= strokeExpansion
  maxX += strokeExpansion
  maxY += strokeExpansion

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Calculate bounds for node SVG overflow content.
 *
 * Some nodes render elements outside their viewBox (e.g., the initial marking
 * arrow in Reachability Graphs extends to negative coordinates). These elements
 * are visible because the node SVGs use overflow="visible", but they are NOT
 * included in reactFlow.getNodesBounds() which only considers node position
 * and dimensions.
 *
 * This function scans node SVGs for <line>, <path>, and <circle> elements
 * that extend outside the node's local coordinate system (viewBox), converts
 * them to global coordinates, and returns the bounding box of all such content.
 */
function getNodeOverflowBoundsFromDOM(
  container: HTMLElement
): Rect | undefined {
  const allNodes = container.querySelectorAll(".react-flow__node")
  const overflowPoints: Point[] = []

  allNodes.forEach((node) => {
    const styleStr = node.getAttribute("style") ?? ""
    const styles = extractStyles(styleStr)
    const nodeX = styles.transform.x
    const nodeY = styles.transform.y

    const svgEl = getNodeBodySvg(node)
    if (!svgEl) return

    // Parse the viewBox to understand the local coordinate system
    const vb = svgEl.getAttribute("viewBox")
    if (!vb) return
    const vbParts = vb.split(/[\s,]+/).map(Number)
    if (vbParts.length < 4) return
    const [vbX, vbY, vbW, vbH] = vbParts

    // Calculate scale from viewBox to rendered size
    const svgW = parseFloat(svgEl.getAttribute("width") ?? `${vbW}`)
    const svgH = parseFloat(svgEl.getAttribute("height") ?? `${vbH}`)
    const scaleX = svgW / vbW
    const scaleY = svgH / vbH

    // Helper: convert a local SVG coordinate to global space
    const toGlobal = (lx: number, ly: number): Point => ({
      x: nodeX + (lx - vbX) * scaleX,
      y: nodeY + (ly - vbY) * scaleY,
    })

    // Check if a local coordinate is outside the viewBox
    const isOverflow = (lx: number, ly: number) =>
      lx < vbX || ly < vbY || lx > vbX + vbW || ly > vbY + vbH

    // Scan <line> elements for overflow content
    svgEl.querySelectorAll("line").forEach((line) => {
      const x1 = parseFloat(line.getAttribute("x1") ?? "0")
      const y1 = parseFloat(line.getAttribute("y1") ?? "0")
      const x2 = parseFloat(line.getAttribute("x2") ?? "0")
      const y2 = parseFloat(line.getAttribute("y2") ?? "0")

      if (isOverflow(x1, y1) || isOverflow(x2, y2)) {
        overflowPoints.push(toGlobal(x1, y1))
        overflowPoints.push(toGlobal(x2, y2))
      }
    })

    // Scan <path> elements for overflow content
    svgEl.querySelectorAll("path").forEach((path) => {
      const d = path.getAttribute("d")
      if (!d) return
      const pathPoints = extractPathPoints(d)
      const hasOverflow = pathPoints.some((p) => isOverflow(p.x, p.y))
      if (hasOverflow) {
        pathPoints.forEach((p) => overflowPoints.push(toGlobal(p.x, p.y)))
      }
    })

    // Scan <polyline> elements for overflow content
    svgEl.querySelectorAll("polyline").forEach((polyline) => {
      const pointsAttr = polyline.getAttribute("points")
      if (!pointsAttr) return
      const coords = pointsAttr
        .trim()
        .split(/[\s,]+/)
        .map(Number)
      for (let i = 0; i + 1 < coords.length; i += 2) {
        const lx = coords[i]
        const ly = coords[i + 1]
        if (isOverflow(lx, ly)) {
          // If any point overflows, include all points
          for (let j = 0; j + 1 < coords.length; j += 2) {
            overflowPoints.push(toGlobal(coords[j], coords[j + 1]))
          }
          break
        }
      }
    })

    // Scan <circle> elements for overflow content
    svgEl.querySelectorAll("circle").forEach((circle) => {
      const cx = parseFloat(circle.getAttribute("cx") ?? "0")
      const cy = parseFloat(circle.getAttribute("cy") ?? "0")
      const r = parseFloat(circle.getAttribute("r") ?? "0")

      if (isOverflow(cx - r, cy - r) || isOverflow(cx + r, cy + r)) {
        overflowPoints.push(toGlobal(cx - r, cy - r))
        overflowPoints.push(toGlobal(cx + r, cy + r))
      }
    })
  })

  if (overflowPoints.length === 0) return undefined

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const p of overflowPoints) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Calculate bounds for rendered SVG text and labels.
 *
 * Some labels extend beyond node/edge geometry and are not reliably captured by
 * node or edge path bounds alone. Measuring rendered text via getBBox() gives us
 * the actual SVG-space bounds that should be included in the export clip.
 */
function getTextBoundsFromDOM(
  container: HTMLElement,
  reactFlow: ReactFlowInstance<Node, Edge>
): Rect | undefined {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let foundVisibleText = false

  const mergeRect = (x1: number, y1: number, x2: number, y2: number) => {
    const localMinX = Math.min(x1, x2)
    const localMinY = Math.min(y1, y2)
    const localMaxX = Math.max(x1, x2)
    const localMaxY = Math.max(y1, y2)

    if (
      !Number.isFinite(localMinX) ||
      !Number.isFinite(localMinY) ||
      !Number.isFinite(localMaxX) ||
      !Number.isFinite(localMaxY)
    ) {
      return
    }

    minX = Math.min(minX, localMinX)
    minY = Math.min(minY, localMinY)
    maxX = Math.max(maxX, localMaxX)
    maxY = Math.max(maxY, localMaxY)
    foundVisibleText = true
  }

  // Node text is usually inside nested node SVGs, so getBBox() is local to the
  // node SVG coordinate system. Convert it to flow coordinates manually using
  // node transform + SVG viewBox scale.
  const nodeElements = container.querySelectorAll(".react-flow__node")
  nodeElements.forEach((nodeEl) => {
    const styleStr = nodeEl.getAttribute("style") ?? ""
    const styles = extractStyles(styleStr)
    const nodeX = styles.transform.x
    const nodeY = styles.transform.y

    const svgEl = getNodeBodySvg(nodeEl)
    if (!svgEl) return

    const viewBox = svgEl.getAttribute("viewBox")
    if (!viewBox) return

    const vbParts = viewBox.split(/[\s,]+/).map(Number)
    if (vbParts.length < 4) return
    const [vbX, vbY, vbW, vbH] = vbParts

    const svgW = parseFloat(svgEl.getAttribute("width") ?? `${vbW}`)
    const svgH = parseFloat(svgEl.getAttribute("height") ?? `${vbH}`)
    if (
      !Number.isFinite(svgW) ||
      !Number.isFinite(svgH) ||
      vbW === 0 ||
      vbH === 0
    ) {
      return
    }
    const scaleX = svgW / vbW
    const scaleY = svgH / vbH

    svgEl.querySelectorAll("text").forEach((textEl) => {
      try {
        const bbox = (textEl as SVGGraphicsElement).getBBox()
        if (
          !Number.isFinite(bbox.x) ||
          !Number.isFinite(bbox.y) ||
          !Number.isFinite(bbox.width) ||
          !Number.isFinite(bbox.height)
        ) {
          return
        }
        if (bbox.width === 0 && bbox.height === 0) {
          return
        }

        const x1 = nodeX + (bbox.x - vbX) * scaleX
        const y1 = nodeY + (bbox.y - vbY) * scaleY
        const x2 = nodeX + (bbox.x + bbox.width - vbX) * scaleX
        const y2 = nodeY + (bbox.y + bbox.height - vbY) * scaleY

        mergeRect(x1, y1, x2, y2)
      } catch {
        // Ignore text nodes that cannot be measured in the current renderer.
      }
    })
  })

  // Edge text is rendered in the edge layer; measuring screen rect and mapping
  // back to flow coordinates keeps us aligned with the current viewport transform.
  const edgeTextElements = container.querySelectorAll(".react-flow__edge text")
  edgeTextElements.forEach((textEl) => {
    try {
      const rect = (textEl as SVGGraphicsElement).getBoundingClientRect()
      if (
        !Number.isFinite(rect.left) ||
        !Number.isFinite(rect.top) ||
        !Number.isFinite(rect.right) ||
        !Number.isFinite(rect.bottom)
      ) {
        return
      }
      if (rect.width === 0 && rect.height === 0) {
        return
      }

      const corners = [
        reactFlow.screenToFlowPosition({ x: rect.left, y: rect.top }),
        reactFlow.screenToFlowPosition({ x: rect.right, y: rect.top }),
        reactFlow.screenToFlowPosition({ x: rect.left, y: rect.bottom }),
        reactFlow.screenToFlowPosition({ x: rect.right, y: rect.bottom }),
      ]
      const xs = corners.map((point) => point.x)
      const ys = corners.map((point) => point.y)

      mergeRect(
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys)
      )
    } catch {
      // Ignore text nodes that cannot be measured in the current renderer.
    }
  })

  if (!foundVisibleText) return undefined

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function mergeBounds(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.width, b.x + b.width)
  const maxY = Math.max(a.y + a.height, b.y + b.height)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function getDiagramBounds(
  reactFlow: ReactFlowInstance<Node, Edge>,
  container?: HTMLElement | null
): Rect {
  const nodes = reactFlow.getNodes()
  let edgeBounds = getBoundingBox(reactFlow.getEdges(), nodes)
  let bounds = reactFlow.getNodesBounds(reactFlow.getNodes())

  // Prefer DOM-based edge bounds calculation (accounts for bezier control points)
  if (container) {
    edgeBounds = getEdgeBoundsFromDOM(container)
  }

  // Fall back to stored points if DOM isn't available
  if (!edgeBounds) {
    edgeBounds = getBoundingBox(reactFlow.getEdges(), nodes)
  }

  if (edgeBounds) {
    bounds = mergeBounds(bounds, edgeBounds)
  }

  // Include overflow content from node SVGs (e.g., initial marking arrows)
  if (container) {
    const overflowBounds = getNodeOverflowBoundsFromDOM(container)
    if (overflowBounds) {
      bounds = mergeBounds(bounds, overflowBounds)
    }

    const textBounds = getTextBoundsFromDOM(container, reactFlow)
    if (textBounds) {
      bounds = mergeBounds(bounds, textBounds)
    }
  }

  return bounds
}

export function getRenderedDiagramBounds(
  reactFlow: ReactFlowInstance<Node, Edge>,
  container: HTMLElement
): Rect {
  let bounds = getNodeBoundsFromDOM(container, reactFlow)

  const edgeBounds = getEdgeBoundsFromDOM(container)
  if (bounds && edgeBounds) {
    bounds = mergeBounds(bounds, edgeBounds)
  } else if (!bounds && edgeBounds) {
    bounds = edgeBounds
  }

  const overflowBounds = getNodeOverflowBoundsFromDOM(container)
  if (bounds && overflowBounds) {
    bounds = mergeBounds(bounds, overflowBounds)
  } else if (!bounds && overflowBounds) {
    bounds = overflowBounds
  }

  const textBounds = getTextBoundsFromDOM(container, reactFlow)
  if (bounds && textBounds) {
    bounds = mergeBounds(bounds, textBounds)
  } else if (!bounds && textBounds) {
    bounds = textBounds
  }

  return bounds ?? { x: 0, y: 0, width: 0, height: 0 }
}

function extractStyles(styleString: string) {
  const transformMatch = styleString.match(
    /transform:\s*translate\((-?\d+\.?\d*)px,\s*(-?\d+\.?\d*)px\)/
  )
  const widthMatch = styleString.match(/width:\s*([^;]+)/)
  const heightMatch = styleString.match(/height:\s*([^;]+)/)

  const x = transformMatch ? parseFloat(transformMatch[1]) : 0
  const y = transformMatch ? parseFloat(transformMatch[2]) : 0

  return {
    transform: { x, y },
    width: widthMatch ? widthMatch[1].trim() : null,
    height: heightMatch ? heightMatch[1].trim() : null,
  }
}

/**
 * Regex to match CSS var() function calls.
 * Captures: (1) variable name, (2) optional fallback value
 *
 * This regex handles nested parentheses in fallbacks like rgba(36, 39, 36, 0.1)
 * by capturing everything after the comma until the matching closing paren.
 */
const VARIABLE_REGEX =
  /var\((--[\w-]+)(?:\s*,\s*([^)]+(?:\([^)]*\)[^)]*)*))?\)/g

type CSSVariableMap = Readonly<Record<string, string>>

/**
 * Resolve a single CSS variable reference to its final value.
 * Handles recursive var() resolution and fallback values.
 */
function resolveCSSVariable(value: string, cssVarMap?: CSSVariableMap): string {
  let result = value
  let prevResult = ""

  // Keep resolving until no more var() calls are found (handles nested vars)
  while (result !== prevResult && result.includes("var(")) {
    prevResult = result
    result = result.replace(
      VARIABLE_REGEX,
      (_match, variableName: string, fallback?: string) => {
        const trimmedName = variableName.trim()
        const mapped = cssVarMap?.[trimmedName]?.trim()
        if (mapped) {
          // If the resolved value itself contains var(), it will be resolved in the next iteration
          return mapped
        }
        const resolved = CSS_VARIABLE_FALLBACKS[trimmedName]
        if (resolved) return resolved

        if (fallback) {
          // Fallback may itself contain var() calls
          return fallback.trim()
        }

        // Variable not found, no fallback - return empty
        // Note: Unresolved variable ${trimmedName} will result in empty value
        return ""
      }
    )
  }

  return result
}

/**
 * Resolve 'currentColor' keyword by looking up the resolved 'color' attribute.
 */
function resolveCurrentColor(
  element: Element,
  inheritedColor: string,
  cssVarMap?: CSSVariableMap
): string {
  // Check if element has a color attribute
  const colorAttr = element.getAttribute("color")
  if (colorAttr) {
    const resolvedColor = resolveCSSVariable(colorAttr, cssVarMap)
    // Handle case where color itself might be currentColor (shouldn't happen, but be safe)
    if (resolvedColor && resolvedColor !== "currentColor") {
      return resolvedColor
    }
  }
  return inheritedColor
}

/**
 * Replace CSS variables and currentColor in all attributes of an element tree.
 *
 * @param node - The DOM node to process
 * @param inheritedColor - The inherited 'currentColor' value from parent elements
 */
function replaceCSSVariables(
  node: Element | ChildNode,
  inheritedColor: string = STROKE_COLOR,
  cssVarMap?: CSSVariableMap
): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element

    // First, resolve the 'color' attribute if present (for currentColor inheritance)
    const currentColor = resolveCurrentColor(element, inheritedColor, cssVarMap)

    // If element has a color attribute, resolve it first
    const colorAttr = element.getAttribute("color")
    if (colorAttr) {
      const resolvedColor = resolveCSSVariable(colorAttr, cssVarMap)
      if (resolvedColor !== colorAttr) {
        element.setAttribute("color", resolvedColor)
      }
    }

    // Process all attributes (including 'style')
    element.getAttributeNames().forEach((attr) => {
      const attrValue = element.getAttribute(attr)
      if (!attrValue) return

      // Resolve CSS variables first
      let resolvedValue = resolveCSSVariable(attrValue, cssVarMap)

      // Resolve 'currentColor' keyword
      if (resolvedValue === "currentColor") {
        resolvedValue = currentColor
      } else if (resolvedValue.includes("currentColor")) {
        resolvedValue = resolvedValue.replace(/currentColor/gi, currentColor)
      }

      // Resolve SVG2 context-stroke and context-fill (not supported by Inkscape/external renderers)
      // These are used in markers to inherit stroke/fill from the referencing element
      if (
        resolvedValue === "context-stroke" ||
        resolvedValue === "context-fill"
      ) {
        resolvedValue = currentColor
      }

      // Normalize font-size to always have px units
      // Some renderers interpret unitless values differently (px vs pt)
      if (attr === "font-size" || attr === "fontSize") {
        // Check if it's a unitless number
        if (/^\d+(\.\d+)?$/.test(resolvedValue)) {
          resolvedValue = `${resolvedValue}px`
        }
      }

      // Remove CSS-only attributes not valid for external SVG renderers
      if (attr === "pointer-events" || attr === "pointerEvents") {
        element.removeAttribute(attr)
        return // Skip setting the attribute
      }

      if (resolvedValue !== attrValue) {
        element.setAttribute(attr, resolvedValue)
      }
    })

    // Recursively process children, passing down the resolved color
    Array.from(element.childNodes).forEach((child) =>
      replaceCSSVariables(child, currentColor, cssVarMap)
    )
  }
  // Text nodes are not processed — CSS variables only appear in attribute values,
  // and processing text content would corrupt user-authored labels containing "var(".
}

/**
 * SVG style properties that should be converted to attributes for PowerPoint compatibility.
 * PowerPoint has poor support for CSS in style attributes but handles direct SVG attributes well.
 */
const SVG_STYLE_TO_ATTRIBUTE = [
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "fill",
  "fill-opacity",
  "opacity",
  "font-size",
  "font-weight",
  "font-family",
  "font-style",
] as const

/**
 * Convert inline style properties to direct SVG attributes for better compatibility.
 * PowerPoint and some other applications don't properly parse CSS in style attributes.
 */
function convertStyleToAttributes(node: Element | ChildNode): void {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return
  }

  const element = node as Element
  const styleAttr = element.getAttribute("style")

  if (styleAttr) {
    const remainingStyles: string[] = []

    // Parse style attribute and convert SVG properties to attributes
    styleAttr.split(";").forEach((declaration) => {
      const [prop, value] = declaration.split(":").map((s) => s.trim())
      if (!prop || !value) return

      // Skip problematic values that can cause issues in PowerPoint
      if (prop === "transition") return // CSS-only, not SVG
      if (prop === "stroke-dasharray" && value === "0") return // Redundant
      // Note: We intentionally do NOT skip opacity: 1.
      // While it's the default in browsers, non-browser SVG renderers (resvg, Inkscape)
      // may not apply the same default, causing overlapping elements to appear darker.

      // Check if this is an SVG property that should be an attribute
      if (
        SVG_STYLE_TO_ATTRIBUTE.includes(
          prop as (typeof SVG_STYLE_TO_ATTRIBUTE)[number]
        )
      ) {
        // Only set if not already present as an attribute
        if (!element.hasAttribute(prop)) {
          element.setAttribute(prop, value)
        }
      } else {
        // Keep non-SVG properties in style
        remainingStyles.push(`${prop}: ${value}`)
      }
    })

    // Update or remove style attribute
    if (remainingStyles.length > 0) {
      element.setAttribute("style", remainingStyles.join("; "))
    } else {
      element.removeAttribute("style")
    }
  }

  // Recursively process children
  Array.from(element.childNodes).forEach(convertStyleToAttributes)
}

/**
 * Default font values matching the browser rendering (app.css / CustomText.tsx).
 * Applied to <text> elements that don't have explicit font attributes,
 * ensuring non-browser SVG renderers (resvg, Inkscape, PowerPoint) render
 * text identically to what the user sees on screen.
 */
const TEXT_FONT_DEFAULTS = {
  "font-size": "16px",
  "font-weight": "400",
  "font-family": "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
} as const

/**
 * Ensure all <text> elements have explicit font-size, font-weight, and font-family.
 *
 * In the browser, text inherits these from CSS (:root font-family, default font-size).
 * In exported SVGs opened in non-browser renderers, missing attributes cause text to
 * render with the renderer's own defaults (often Times New Roman at an arbitrary size).
 *
 * This pass runs AFTER convertStyleToAttributes so any font props already extracted
 * from inline styles are present as attributes.
 */
function ensureTextFontDefaults(svg: Element): void {
  svg.querySelectorAll("text").forEach((textEl) => {
    for (const [attr, defaultValue] of Object.entries(TEXT_FONT_DEFAULTS)) {
      if (!textEl.hasAttribute(attr)) {
        textEl.setAttribute(attr, defaultValue)
      }
    }
  })
}

/**
 * Replace `text-decoration="underline"` on `<text>` elements with manual
 * `<line>` siblings so the underline is visible in non-browser renderers.
 *
 * resvg 2.6.2 has a rendering bug where 3+ `text-decoration="underline"`
 * attributes across nested `<svg>` elements cause unrelated paths (particularly
 * vertical lines) to disappear. This workaround removes the problematic
 * attribute and draws explicit underline lines using `getBBox()` for accurate
 * text measurements.
 *
 * The SVG must be temporarily attached to the DOM for `getBBox()` to work.
 */
function replaceTextDecorationWithManualUnderline(svg: SVGSVGElement): void {
  const SVG_NS = "http://www.w3.org/2000/svg"
  const underlinedTexts = svg.querySelectorAll(
    'text[text-decoration="underline"]'
  )

  if (underlinedTexts.length === 0) return

  // Temporarily attach to the DOM (off-screen) so getBBox() works
  svg.style.position = "absolute"
  svg.style.left = "-9999px"
  svg.style.top = "-9999px"
  document.body.appendChild(svg)

  try {
    underlinedTexts.forEach((textEl) => {
      textEl.removeAttribute("text-decoration")

      // Measure the text bounding box in SVG coordinate space
      const bbox = (textEl as SVGTextElement).getBBox()

      const line = document.createElementNS(SVG_NS, "line")
      // Position the underline just below the text baseline
      const underlineY = bbox.y + bbox.height
      line.setAttribute("x1", String(bbox.x))
      line.setAttribute("x2", String(bbox.x + bbox.width))
      line.setAttribute("y1", String(underlineY))
      line.setAttribute("y2", String(underlineY))
      line.setAttribute("stroke", textEl.getAttribute("fill") || STROKE_COLOR)
      line.setAttribute("stroke-width", "1.2")

      // Insert the line as a sibling right after the text element
      textEl.parentNode?.insertBefore(line, textEl.nextSibling)
    })
  } finally {
    document.body.removeChild(svg)
    svg.style.removeProperty("position")
    svg.style.removeProperty("left")
    svg.style.removeProperty("top")
  }
}

/**
 * Final safety pass: strip any legacy <marker> references that could sneak in
 * from third-party content. Keeps exports clean for PowerPoint/Keynote.
 */
function removeMarkerElements(svg: Element): void {
  svg.querySelectorAll("marker").forEach((el) => el.remove())
  svg
    .querySelectorAll("[marker-start]")
    .forEach((el) => el.removeAttribute("marker-start"))
  svg
    .querySelectorAll("[marker-end]")
    .forEach((el) => el.removeAttribute("marker-end"))
}

/**
 * @internal — Exported for unit testing only. Not part of the public API.
 */
export const __testing = {
  filterRenderedElements,
  getRenderedDiagramBounds,
  extractPathPoints,
  extractStyles,
  resolveCSSVariable,
  replaceCSSVariables,
  convertStyleToAttributes,
  ensureTextFontDefaults,
  removeMarkerElements,
  replaceTextDecorationWithManualUnderline,
  mergeBounds,
  getNodeBoundsFromDOM,
  getNodeOverflowBoundsFromDOM,
} as const
