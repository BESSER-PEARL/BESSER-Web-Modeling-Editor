/**
 * A2A notation ported from develop's `a2a-notation.tsx`: the tag parser, the
 * outbound badge on AgentState cards, the inbound badge on transitions, and
 * both badges reaching the SVG export. Data shape as the Multi-agent Bug
 * Fixing template ships it.
 */
import { afterEach, describe, expect, it } from "vitest"
import type { ComponentProps } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { Position, ReactFlowProvider, type Edge, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import {
  AssessmentSelectionStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createAssessmentSelectionStore } from "@/store/assessmentSelectionStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import { AgentState } from "@/nodes/agentDiagram/AgentState"
import { AgentDiagramEdge } from "@/edges/edgeTypes/AgentDiagramEdge"
import { a2aTitle, parseA2AOutTags, parseA2ATag } from "@/utils/a2aNotation"
import { getSVG } from "@/utils/exportUtils"

const OUT_1 =
  "a2a:out;peer=AgentReviewer;ref=aaa4c0f6-23f7-43ed-b2f5-5a00bc3d1ea8;flow=flow-11;order=1;kind=revises"
const OUT_2 = "a2a:out;peer=Coder2;flow=f2"
const IN =
  "a2a:in;peer=AgentReviewer;ref=aaa4c0f6-23f7-43ed-b2f5-5a00bc3d1ea8;flow=flow-09;kind=supervises"

const t = (_key: string, fallback?: string) => fallback ?? ""

describe("parseA2ATag", () => {
  it("reads direction and the known keys", () => {
    expect(parseA2ATag(OUT_1)).toEqual({
      dir: "out",
      raw: OUT_1,
      peer: "AgentReviewer",
      ref: "aaa4c0f6-23f7-43ed-b2f5-5a00bc3d1ea8",
      flow: "flow-11",
      order: "1",
      kind: "revises",
    })
    expect(parseA2ATag(`  ${IN}  `)?.dir).toBe("in")
    expect(parseA2ATag(`  ${IN}  `)?.raw).toBe(IN)
  })

  it("keeps '=' inside values and skips unknown or malformed parts", () => {
    expect(parseA2ATag("a2a:in;peer=a=b;=x;junk;colour=red")).toEqual({
      dir: "in",
      raw: "a2a:in;peer=a=b;=x;junk;colour=red",
      peer: "a=b",
    })
  })

  it("rejects anything that is not an a2a:in / a2a:out tag", () => {
    expect(parseA2ATag(undefined)).toBeUndefined()
    expect(parseA2ATag("")).toBeUndefined()
    expect(parseA2ATag("greet")).toBeUndefined()
    expect(parseA2ATag("a2a:both;peer=x")).toBeUndefined()
    expect(parseA2ATag("A2A:in;peer=x")).toBeUndefined()
  })
})

describe("parseA2AOutTags / a2aTitle", () => {
  it("keeps only the a2a:out lines of a description (LF or CRLF)", () => {
    const tags = parseA2AOutTags(`note\r\n${OUT_1}\n${IN}\n${OUT_2}`)
    expect(tags.map((tag) => tag.peer)).toEqual(["AgentReviewer", "Coder2"])
    expect(parseA2AOutTags(undefined)).toEqual([])
  })

  it("lists one Send to / Receive from line per tag, 'peer' when unnamed", () => {
    const tags = [parseA2ATag(OUT_1)!, parseA2ATag("a2a:in;flow=f")!]
    expect(a2aTitle(tags, t)).toBe("Send to AgentReviewer\nReceive from peer")
  })
})

const wrap = (ydoc: Y.Doc, diagram: StoreApi<DiagramStore>, ui: React.ReactNode) => (
  <DiagramStoreContext.Provider value={diagram}>
    <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
      <PopoverStoreContext.Provider value={createPopoverStore()}>
        <AssessmentSelectionStoreContext.Provider value={createAssessmentSelectionStore()}>
          {ui}
        </AssessmentSelectionStoreContext.Provider>
      </PopoverStoreContext.Provider>
    </MetadataStoreContext.Provider>
  </DiagramStoreContext.Provider>
)

const renderState = (data: Record<string, unknown>, height = 90) => {
  const node: Node = {
    id: "s1",
    type: "AgentState",
    position: { x: 0, y: 0 },
    width: 250,
    height,
    data: { name: "Reproduce_and_fix_bug", ...data },
  }
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc) as StoreApi<DiagramStore>
  act(() => diagram.getState().setNodes([node]))
  const utils = render(
    wrap(
      ydoc,
      diagram,
      <ReactFlowProvider>
        <div className="react-flow__viewport">
          <div
            className="react-flow__node"
            style={{ transform: "translate(0px, 0px)", width: 250, height }}
          >
            <AgentState
              {...({ id: node.id, width: 250, height, data: node.data } as unknown as ComponentProps<typeof AgentState>)}
            />
          </div>
        </div>
      </ReactFlowProvider>
    )
  )
  return { diagram, ...utils }
}

const reply = { id: "b1", name: "LLM Reply", replyType: "llm" }

describe("AgentState outbound A2A badge", () => {
  afterEach(() => cleanup())

  it("draws one badge with the tag count; the title lists the peers", () => {
    renderState({ bodies: [reply], description: `${OUT_1}\n${OUT_2}` })
    const badge = screen.getByTestId("a2a-out-badge")
    expect(badge.textContent).toBe("A2A×2")
    expect(badge.getAttribute("title")).toBe("Send to AgentReviewer\nSend to Coder2")
  })

  it("is drawn inside the exported card, below the replies", () => {
    const { container } = renderState({ bodies: [reply], description: OUT_1 })
    const card = container.querySelector("[data-export-html]")!
    const badge = screen.getByTestId("a2a-out-badge")
    expect(card.contains(badge)).toBe(true)
    expect(badge.textContent).toBe("A2A")
    expect(badge.parentElement!.lastElementChild).toBe(badge)
  })

  it("grows the card to fit the badge row", () => {
    const { diagram } = renderState({ bodies: [reply], description: OUT_1 })
    // header 44 + padding 16 + one reply 30 + badge row 25
    expect(diagram.getState().nodes[0].height).toBe(115)
  })

  it("a click toggles the peer list, as in develop", () => {
    renderState({ bodies: [reply], description: OUT_1 })
    const badge = screen.getByTestId("a2a-out-badge")
    expect(screen.queryByTestId("a2a-details")).toBeNull()
    fireEvent.click(badge)
    expect(badge.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByTestId("a2a-details").textContent).toBe("Send to AgentReviewer")
    fireEvent.click(badge)
    expect(screen.queryByTestId("a2a-details")).toBeNull()
  })

  it("is absent without a2a:out lines and on reasoning states (develop parity)", () => {
    renderState({ bodies: [reply], description: `note\n${IN}` })
    expect(screen.queryByTestId("a2a-out-badge")).toBeNull()
    cleanup()
    renderState({ stateType: "reasoning", description: OUT_1 })
    expect(screen.queryByTestId("a2a-out-badge")).toBeNull()
  })

  it("reaches the SVG export", () => {
    const { container } = renderState({ bodies: [reply], description: OUT_1 })
    const svg = getSVG(container, { x: 0, y: 0, width: 400, height: 300 }, { svgMode: "web" })
    expect(svg).toContain(">A2A</text>")
  })
})

const node = (id: string, x: number, y: number): Node => ({
  id,
  type: "AgentState",
  position: { x, y },
  width: 160,
  height: 80,
  measured: { width: 160, height: 80 },
  data: { name: id },
})

const renderEdge = (data: Record<string, unknown>, targetY = 300) => {
  const nodes = [node("a", 0, 0), node("b", 0, targetY)]
  const edge: Edge = { id: "t", type: "AgentStateTransition", source: "a", target: "b", data }
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc) as StoreApi<DiagramStore>
  act(() => {
    diagram.getState().setNodes(nodes)
    diagram.getState().setEdges([edge])
  })
  return render(
    wrap(
      ydoc,
      diagram,
      <ReactFlowProvider initialNodes={nodes} initialEdges={[edge]}>
        <div className="react-flow__viewport">
          <svg>
            <g className="react-flow__edge">
              <AgentDiagramEdge
                id="t"
                type="AgentStateTransition"
                source="a"
                target="b"
                sourceX={80}
                sourceY={80}
                targetX={80}
                targetY={targetY}
                sourcePosition={Position.Bottom}
                targetPosition={Position.Top}
                data={data as never}
              />
            </g>
          </svg>
        </div>
      </ReactFlowProvider>
    )
  )
}

const inbound = {
  name: IN,
  label: IN,
  transitionType: "predefined",
  predefined: {
    predefinedType: "when_intent_matched",
    intentName: "recv_AgentReviewer_Reproduce_and_fix_bug",
  },
}

const labelOf = (container: HTMLElement) =>
  container.querySelector('[data-testid="edge-middle-label"]')

describe("AgentStateTransition inbound A2A badge", () => {
  afterEach(() => cleanup())

  // Before: the canvas label read "a2a:in;peer=AgentReviewer;ref=a…".
  it("hides the a2a:in tag from the label and draws the badge instead", () => {
    const { container } = renderEdge(inbound)
    const label = labelOf(container)!
    expect(label.textContent).not.toContain("a2a:")
    expect(label.textContent).toContain("recv_AgentReviewer")
    const badge = screen.getByTestId("a2a-in-badge")
    expect(badge.querySelector("title")?.textContent).toBe("Receive from AgentReviewer")
  })

  it("stacks above a label that sits on the curve, clear of it", () => {
    const { container } = renderEdge(inbound)
    const labelY = Number(labelOf(container)!.getAttribute("y"))
    const [x, y] = /translate\(([-\d.]+), ([-\d.]+)\)/
      .exec(screen.getByTestId("a2a-in-badge").getAttribute("transform")!)!
      .slice(1)
      .map(Number)
    expect(x + 31).toBeCloseTo(Number(labelOf(container)!.getAttribute("x")))
    expect(y + 20).toBeLessThanOrEqual(labelY - 8)
  })

  // Short edge: the label moves beside the line (right of it), so the badge
  // takes the curve's other side instead of landing on a node.
  it("on a short edge, sits left of the line, away from the moved label", () => {
    const { container } = renderEdge(inbound, 130)
    const labelX = Number(labelOf(container)!.getAttribute("x"))
    const badgeX = Number(
      /translate\(([-\d.]+)/.exec(
        screen.getByTestId("a2a-in-badge").getAttribute("transform")!
      )![1]
    )
    expect(labelX).toBeGreaterThan(80)
    expect(badgeX + 62).toBe(80 - 6)
  })

  it("a click toggles the peer, as in develop", () => {
    renderEdge(inbound)
    const badge = screen.getByTestId("a2a-in-badge")
    fireEvent.click(badge)
    expect(screen.getByTestId("a2a-details").textContent).toBe("Receive from AgentReviewer")
    fireEvent.click(badge)
    expect(screen.queryByTestId("a2a-details")).toBeNull()
  })

  it("plain names keep their label and get no badge", () => {
    const { container } = renderEdge({ ...inbound, name: "ask", label: "ask" })
    expect(labelOf(container)!.textContent).toContain("ask")
    expect(screen.queryByTestId("a2a-in-badge")).toBeNull()
    cleanup()
    renderEdge({ ...inbound, name: OUT_1 })
    expect(screen.queryByTestId("a2a-in-badge")).toBeNull()
  })

  it("reaches the SVG export with the edge labels", () => {
    const { container } = renderEdge(inbound)
    const svg = getSVG(container, { x: 0, y: 0, width: 400, height: 400 }, { svgMode: "web" })
    // Only the `.edge-labels` group is cloned: it must carry its own position
    // (live: the badge landed at the diagram origin).
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml")
    const exported = doc.querySelector('[data-testid="a2a-in-badge"]')!
    expect(exported.getAttribute("transform")).toBe(
      screen.getByTestId("a2a-in-badge").getAttribute("transform")
    )
    expect(exported.getAttribute("transform")).toMatch(/^translate\(/)
    expect(svg).toContain(">A2A</text>")
  })
})
