/**
 * Agentic BPMN gateways ported from develop: the inspector's agentic switch,
 * role, trust score and governance DSL section (gated on `agenticEnabled`
 * and on Parallel / Inclusive gateways), and the canvas glyphs. Data as the
 * "Agentic starter" template ships it.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import * as Y from "yjs"
import type { Edge, Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext, MetadataStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import {
  BPMNGatewayEditPopover,
  withGatewayAgentic,
} from "@/components/popovers/bpmnDiagram/BPMNGatewayEditPopover"
import { BPMNGatewayNodeSVG } from "@/components/svgs/nodes/bpmnDiagram/BPMNGatewayNodeSVG"
import { generateGovernanceDsl } from "@/services/bpmnCollaborationBlocks"
import type { BPMNGatewayProps } from "@/types"
import type { UMLModel } from "@/typings"

const STARTER = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../webapp/src/main/templates/pattern/bpmn/agentic_starter.json"),
    "utf8"
  )
) as UMLModel

afterEach(cleanup)

const setup = (opts: { agentic?: boolean; nodes?: Node[]; edges?: Edge[] } = {}) => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc) as StoreApi<DiagramStore>
  const metadata = createMetadataStore(ydoc)
  metadata.getState().setAgenticEnabled(opts.agentic ?? true)
  diagram.getState().setNodes(opts.nodes ?? (structuredClone(STARTER.nodes) as unknown as Node[]))
  diagram.getState().setEdges(opts.edges ?? (structuredClone(STARTER.edges) as unknown as Edge[]))
  diagram.getState().initializeUndoManager()
  const open = (elementId: string) =>
    render(
      <DiagramStoreContext.Provider value={diagram}>
        <MetadataStoreContext.Provider value={metadata}>
          <BPMNGatewayEditPopover elementId={elementId} />
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    )
  const dataOf = (id: string) =>
    diagram.getState().nodes.find((n) => n.id === id)!.data as BPMNGatewayProps
  return { diagram, metadata, open, dataOf }
}

const gateway = (id: string, data: Partial<BPMNGatewayProps>): Node => ({
  id,
  type: "bpmnGateway",
  position: { x: 0, y: 0 },
  width: 40,
  height: 40,
  data: { name: "", gatewayType: "parallel", ...data },
})

const selectOption = (label: RegExp, option: string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: label }))
  fireEvent.click(within(screen.getByRole("listbox")).getByText(option))
}

describe("withGatewayAgentic", () => {
  it("fills develop's defaults on and drops every agentic key off", () => {
    const on = withGatewayAgentic({ name: "G", gatewayType: "parallel" }, true)
    expect(on).toEqual({
      name: "G",
      gatewayType: "parallel",
      isAgentic: true,
      gatewayRole: "diverging",
      trustScore: 0,
    })
    const off = withGatewayAgentic({ ...on, gatewayRole: "merging", governanceDsl: "x" }, false)
    expect(off).toEqual({ name: "G", gatewayType: "parallel" })
  })
})

describe("BPMNGatewayEditPopover agentic section", () => {
  it("is hidden while the agentic perspective is off and on non-eligible types", () => {
    const off = setup({ agentic: false })
    off.open("gw-merge")
    expect(screen.queryByLabelText("Agentic")).toBeNull()
    cleanup()

    const exclusive = setup({ nodes: [gateway("g", { gatewayType: "exclusive" })], edges: [] })
    exclusive.open("g")
    expect(screen.queryByLabelText("Agentic")).toBeNull()
  })

  it("toggles agentic as one store write; a plain gateway keeps no agentic keys", () => {
    const { open, dataOf, diagram } = setup({ nodes: [gateway("g", {})], edges: [] })
    open("g")
    fireEvent.click(screen.getByLabelText("Agentic"))
    expect(dataOf("g")).toMatchObject({ isAgentic: true, gatewayRole: "diverging", trustScore: 0 })
    expect(diagram.getState().undoManager!.undoStack).toHaveLength(1)

    fireEvent.click(screen.getByLabelText("Agentic"))
    expect(Object.keys(dataOf("g")).sort()).toEqual(["gatewayType", "name"])
  })

  it("offers Merging only below an agentic diverging gateway", () => {
    const { open } = setup()
    open("gw-merge")
    expect(screen.getByRole("button", { name: "Merging" })).toHaveProperty("disabled", false)
    cleanup()

    const lone = setup({ nodes: [gateway("g", { isAgentic: true, gatewayRole: "diverging" })], edges: [] })
    lone.open("g")
    expect(screen.getByRole("button", { name: "Merging" })).toHaveProperty("disabled", true)
    fireEvent.click(screen.getByRole("button", { name: "Merging" }))
    expect(lone.dataOf("g").gatewayRole).toBe("diverging")
  })

  it("flags an orphaned merging gateway", () => {
    const { open } = setup({
      nodes: [gateway("g", { isAgentic: true, gatewayRole: "merging", trustScore: 0 })],
      edges: [],
    })
    open("g")
    expect(screen.getByTestId("bpmn-gateway-orphan-hint")).toBeDefined()
    // The current role stays selectable.
    expect(screen.getByRole("button", { name: "Merging" })).toHaveProperty("disabled", false)
  })

  it("clamps the trust score to 0-100 (NaN -> 0)", () => {
    const { open, dataOf } = setup()
    open("gw-merge")
    const input = screen.getByLabelText("Trust score (0-100)")
    fireEvent.change(input, { target: { value: "150" } })
    expect(dataOf("gw-merge").trustScore).toBe(100)
    fireEvent.change(input, { target: { value: "abc" } })
    expect(dataOf("gw-merge").trustScore).toBe(0)
  })

  it("propagates a diverging gateway's type to its merging gateway in one undo step", () => {
    const { open, dataOf, diagram } = setup()
    open("gw-diverge")
    selectOption(/Gateway Type/, "Inclusive")
    expect(dataOf("gw-diverge").gatewayType).toBe("inclusive")
    expect(dataOf("gw-merge").gatewayType).toBe("inclusive")
    expect(diagram.getState().undoManager!.undoStack).toHaveLength(1)

    // The canvas re-reads the Y.Doc after an undo; do the same here.
    act(() => {
      diagram.getState().undo()
      diagram.getState().updateNodesFromYjs()
    })
    expect(dataOf("gw-diverge").gatewayType).toBe("parallel")
    expect(dataOf("gw-merge").gatewayType).toBe("parallel")
  })

  it("drops the agentic fields when switching to a non-eligible type", () => {
    const { open, dataOf } = setup()
    open("gw-merge")
    selectOption(/Gateway Type/, "Exclusive")
    expect(dataOf("gw-merge")).toEqual({ name: "", gatewayType: "exclusive" })
    expect(dataOf("gw-diverge").gatewayType).toBe("parallel")
  })
})

describe("BPMNGatewayEditPopover governance section", () => {
  it("shows only on merging gateways", () => {
    const { open } = setup()
    open("gw-diverge")
    expect(screen.queryByTestId("bpmn-governance-section")).toBeNull()
    cleanup()
    setup().open("gw-merge")
    expect(screen.getByTestId("bpmn-governance-section")).toBeDefined()
  })

  it("Generate writes the selected policy's DSL; Regenerate asks before replacing", () => {
    const { open, dataOf, diagram } = setup()
    diagram.getState().setNodes((all) =>
      all.map((n) =>
        n.id === "gw-merge" ? { ...n, data: withGatewayAgentic({ ...(n.data as BPMNGatewayProps), governanceDsl: undefined }, true) } : n
      )
    )
    open("gw-merge")
    selectOption(/Decision policy/, "Leader-driven")
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))
    const model = { nodes: diagram.getState().nodes, edges: diagram.getState().edges } as unknown as UMLModel
    expect(dataOf("gw-merge").governanceDsl).toBe(generateGovernanceDsl("gw-merge", model, "LeaderDrivenPolicy"))
    expect(dataOf("gw-merge").governanceDsl).toContain("Participant list : AgentReviewer\n")

    selectOption(/Decision policy/, "Consensus")
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))
    // Nothing is replaced until the user confirms.
    expect(dataOf("gw-merge").governanceDsl).toContain("LeaderDrivenPolicy")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(dataOf("gw-merge").governanceDsl).toContain("LeaderDrivenPolicy")

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))
    fireEvent.click(screen.getByRole("button", { name: "Replace" }))
    expect(dataOf("gw-merge").governanceDsl).toBe(generateGovernanceDsl("gw-merge", model, "ConsensusPolicy"))
  })

  it("the template's DSL is what the generator produces for the same block", () => {
    const merge = STARTER.nodes.find((n) => n.id === "gw-merge")!
    expect(generateGovernanceDsl("gw-merge", STARTER, "MajorityPolicy")).toBe(
      (merge.data as BPMNGatewayProps).governanceDsl
    )
  })
})

describe("BPMNGatewayNodeSVG agentic glyphs", () => {
  const draw = (data: Partial<BPMNGatewayProps>) => {
    const diagram = createDiagramStore(new Y.Doc()) as StoreApi<DiagramStore>
    const { container } = render(
      <DiagramStoreContext.Provider value={diagram}>
        <BPMNGatewayNodeSVG
          id="g"
          width={40}
          height={40}
          data={{ name: "", gatewayType: "parallel", ...data } as BPMNGatewayProps}
        />
      </DiagramStoreContext.Provider>
    )
    const has = (testId: string) => container.querySelector(`[data-testid="${testId}"]`) !== null
    return {
      bot: has("agentic-bot-icon"),
      merge: has("bpmn-merge-marker"),
      badge: has("bpmn-governance-badge"),
    }
  }

  it("draws nothing on a plain or a non-eligible gateway", () => {
    expect(draw({})).toEqual({ bot: false, merge: false, badge: false })
    expect(draw({ gatewayType: "exclusive", isAgentic: true, gatewayRole: "merging", governanceDsl: "x" })).toEqual({
      bot: false,
      merge: false,
      badge: false,
    })
  })

  it("bot icon on diverging; merge marker on merging; badge once a policy is written", () => {
    expect(draw({ isAgentic: true, gatewayRole: "diverging" })).toEqual({ bot: true, merge: false, badge: false })
    expect(draw({ gatewayType: "inclusive", isAgentic: true, gatewayRole: "merging", governanceDsl: "  " })).toEqual({
      bot: true,
      merge: true,
      badge: false,
    })
    expect(draw({ isAgentic: true, gatewayRole: "merging", governanceDsl: "Scopes:" })).toEqual({
      bot: true,
      merge: true,
      badge: true,
    })
  })

  it("places the glyphs where develop does", () => {
    const diagram = createDiagramStore(new Y.Doc()) as StoreApi<DiagramStore>
    const { container } = render(
      <DiagramStoreContext.Provider value={diagram}>
        <BPMNGatewayNodeSVG
          id="g"
          width={40}
          height={40}
          data={{ name: "", gatewayType: "parallel", isAgentic: true, gatewayRole: "merging", governanceDsl: "x" }}
        />
      </DiagramStoreContext.Provider>
    )
    const q = (id: string) => container.querySelector(`[data-testid="${id}"]`)!
    expect(q("agentic-bot-icon").getAttribute("transform")).toBe("translate(-4, -4)")
    expect([q("bpmn-merge-marker").getAttribute("x"), q("bpmn-merge-marker").getAttribute("y")]).toEqual(["28", "28"])
    expect([q("bpmn-governance-badge").getAttribute("x"), q("bpmn-governance-badge").getAttribute("y")]).toEqual([
      "28",
      "-6",
    ])
  })
})
