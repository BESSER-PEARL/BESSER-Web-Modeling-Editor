import type { Edge, Node } from "@xyflow/react"
import { useDiagramStore, useDiagramStoreApi } from "@/store/context"
import { useClassNotation } from "@/store/settingsStore"
import { computeFloatingLayout, type FloatingEdgeLayout } from "@/utils/floatingEdges"
import { estimateLabelWidth } from "@/utils/edgeLabelPlacement"

let measureCtx: CanvasRenderingContext2D | null | undefined
/** Width of a 16px edge label in the editor font (canvas), estimate headless. */
const measureLabel = (text: string): number => {
  if (measureCtx === undefined) {
    measureCtx = null
    const headless =
      typeof document === "undefined" ||
      typeof navigator === "undefined" ||
      /jsdom/i.test(navigator.userAgent)
    if (!headless) {
      measureCtx = document.createElement("canvas").getContext("2d")
      if (measureCtx) {
        const host = document.querySelector(".react-flow") ?? document.body
        measureCtx.font = `16px ${getComputedStyle(host).fontFamily || "sans-serif"}`
      }
    }
  }
  return measureCtx ? Math.ceil(measureCtx.measureText(text).width) + 2 : estimateLabelWidth(text)
}

interface Cached {
  nodes: readonly Node[]
  edges: readonly Edge[]
  er: boolean
  layout: Map<string, FloatingEdgeLayout>
}

/** Latest layout per diagram store; per-edge objects are reused while unchanged. */
const cacheByStore = new WeakMap<object, Cached>()

const sameLayout = (a: FloatingEdgeLayout, b: FloatingEdgeLayout) =>
  JSON.stringify(a) === JSON.stringify(b)

const layoutFor = (
  storeKey: object,
  nodes: readonly Node[],
  edges: readonly Edge[],
  er: boolean
): Map<string, FloatingEdgeLayout> => {
  const cached = cacheByStore.get(storeKey)
  if (cached && cached.nodes === nodes && cached.edges === edges && cached.er === er) {
    return cached.layout
  }
  const next = computeFloatingLayout(nodes, edges, {
    measure: measureLabel,
    erNotation: er,
    previous: cached?.er === er ? cached.layout : undefined,
  })
  if (cached) {
    // Keep identities of unchanged edges so their components skip re-rendering.
    for (const [id, layout] of next) {
      const prev = cached.layout.get(id)
      if (prev && sameLayout(prev, layout)) next.set(id, prev)
    }
  }
  cacheByStore.set(storeKey, { nodes, edges, er, layout: next })
  return next
}

/**
 * Floating ports, route and end-label placement of one class-diagram edge,
 * recomputed for the whole diagram once per store snapshot (live while a
 * class moves). Undefined for an edge that has no node at one end.
 */
export const useFloatingEdgeLayout = (edgeId: string, enabled = true): FloatingEdgeLayout | undefined => {
  const storeApi = useDiagramStoreApi()
  const er = useClassNotation() === "ER"
  return useDiagramStore((state) =>
    enabled ? layoutFor(storeApi, state.nodes, state.edges, er).get(edgeId) : undefined
  )
}
