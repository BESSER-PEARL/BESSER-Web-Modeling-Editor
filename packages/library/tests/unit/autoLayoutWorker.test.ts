import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Edge, Node } from "@xyflow/react"
import type { ElkNode } from "elkjs/lib/elk.bundled.js"
import { UMLDiagramType } from "@/types"

// Stand-in for the worker-backed `elk-api` ELK: records the graphs it is
// given and lays them out with the real (main-thread) ELK, or never answers
// when the worker is "broken".
const api = vi.hoisted(() => ({
  graphs: [] as ElkNode[],
  workers: 0,
  hang: false,
}))
vi.mock("elkjs/lib/elk-api.js", async () => {
  const { default: Bundled } = await import("elkjs/lib/elk.bundled.js")
  return {
    default: class {
      inner = new Bundled()
      constructor({ workerFactory }: { workerFactory: () => unknown }) {
        workerFactory()
      }
      layout(graph: ElkNode) {
        api.graphs.push(graph)
        return api.hang ? new Promise(() => {}) : this.inner.layout(graph)
      }
    },
  }
})

class FakeWorker {
  constructor() {
    api.workers += 1
  }
  addEventListener(type: string, listener: () => void) {
    // A worker that fails to load reports an `error` event.
    if (type === "error" && api.hang) setTimeout(listener, 0)
  }
  postMessage() {}
  terminate() {}
}

const classes = (n: number) => {
  const nodes: Node[] = Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    type: "class",
    position: { x: i * 10, y: 0 },
    measured: { width: 160, height: 100 },
    data: { name: `C${i}`, attributes: [], methods: [] },
  }))
  const edges: Edge[] = nodes.slice(1).map((node, i) => ({
    id: `e${i}`,
    source: node.id,
    target: `n${Math.floor(i / 2)}`,
    type: "ClassBidirectional",
    data: {},
  }))
  return { nodes, edges }
}

beforeEach(() => {
  vi.resetModules()
  api.graphs = []
  api.workers = 0
  api.hang = false
})
afterEach(() => vi.unstubAllGlobals())

describe("auto-layout ELK runs off the main thread", () => {
  // Review finding: ELK ran on the main thread, freezing the page for
  // seconds on a 100-node compact layout.
  it("uses one shared Web Worker when the platform has workers", async () => {
    vi.stubGlobal("Worker", FakeWorker)
    const { computeAutoLayout } = await import("@/utils/autoLayout")
    const { nodes, edges } = classes(4)
    const first = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram)
    await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram)
    expect(api.graphs.length).toBeGreaterThanOrEqual(2)
    expect(api.workers).toBe(1)
    expect(first.nodes).toHaveLength(4)
  })

  it("falls back to the main thread when the worker fails to load", async () => {
    vi.stubGlobal("Worker", FakeWorker)
    api.hang = true
    const { computeAutoLayout } = await import("@/utils/autoLayout")
    const { nodes, edges } = classes(4)
    const result = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram)
    expect(result.nodes).toHaveLength(4)
    expect(result.nodes.some((n, i) => n.position !== nodes[i].position)).toBe(true)
  })

  // A CSP / SecurityError makes `new Worker` throw; the rejected promise must
  // not stay cached and fail every later layout.
  it("falls back to the main thread, every time, when `new Worker` throws", async () => {
    let constructed = 0
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          constructed += 1
          throw new DOMException("blocked", "SecurityError")
        }
      }
    )
    const { computeAutoLayout } = await import("@/utils/autoLayout")
    const { nodes, edges } = classes(3)
    const first = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram)
    const second = await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram)
    expect(first.nodes).toHaveLength(3)
    expect(second.nodes).toHaveLength(3)
    expect(constructed).toBe(1)
  })

  it("scales the compact stress budget down with the graph size", async () => {
    vi.stubGlobal("Worker", FakeWorker)
    const { computeAutoLayout } = await import("@/utils/autoLayout")
    const iterations = async (n: number) => {
      api.graphs = []
      const { nodes, edges } = classes(n)
      await computeAutoLayout(nodes, edges, UMLDiagramType.ClassDiagram, {
        strategy: "compact",
      })
      const stress = api.graphs.find(
        (g) => g.layoutOptions?.["elk.algorithm"] === "stress"
      )!
      return Number(stress.layoutOptions!["elk.stress.iterationLimit"])
    }
    const small = await iterations(10)
    const large = await iterations(120)
    expect(small).toBe(400)
    expect(large).toBeLessThan(small / 2)
  }, 60_000)
})
