import { afterEach, describe, expect, it } from "vitest"
import React from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import {
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import {
  BPMNTaskNodeSVG,
  agenticTaskMinHeight,
} from "@/components/svgs/nodes/bpmnDiagram/BPMNTaskNodeSVG"
import {
  BPMNSwimlaneNodeSVG,
  laneRoleBadge,
} from "@/components/svgs/nodes/bpmnDiagram/BPMNSwimlaneNodeSVG"
import { BPMNTaskEditPopover } from "@/components/popovers/bpmnDiagram/BPMNTaskEditPopover"
import {
  BPMNSwimlaneEditPopover,
  displayLaneRole,
} from "@/components/popovers/bpmnDiagram/BPMNSwimlaneEditPopover"
import { resolveElementInspector } from "@/components/inspectors/registry"
import "@/components/popovers/PopoverManager"

/**
 * Agentic BPMN tasks and lanes (develop bpmn-task-* / bpmn-swimlane-*):
 * canvas markers, the lane popover, agentic fields gated on the agentic
 * perspective, and plain BPMN data free of agentic keys (develop 52ae1c89).
 */

afterEach(cleanup)

const pool: Node = {
  id: "pool",
  type: "bpmnPool",
  position: { x: 0, y: 0 },
  width: 600,
  height: 240,
  data: { name: "Pool" },
}
const lane = (id: string, y: number, data: Record<string, unknown> = {}): Node => ({
  id,
  type: "bpmnSwimlane",
  parentId: "pool",
  position: { x: 40, y },
  width: 560,
  height: 120,
  draggable: false,
  data: { name: id, ...data },
})
const task = (data: Record<string, unknown> = {}, parentId = "laneA"): Node => ({
  id: "task",
  type: "bpmnTask",
  parentId,
  position: { x: 40, y: 20 },
  width: 160,
  height: 50,
  data: { name: "Fix bug", taskType: "user", marker: "loop", ...data },
})

const setup = (ui: React.ReactElement, nodes: Node[], agenticEnabled = true) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  const popover = createPopoverStore()
  act(() => {
    diagram.getState().setNodes(nodes)
    diagram.getState().initializeUndoManager()
    metadata.getState().setAgenticEnabled(agenticEnabled)
  })
  render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={popover}>
          <ReactFlowProvider>{ui}</ReactFlowProvider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  const byId = (id: string) => diagram.getState().nodes.find((n) => n.id === id)!
  return { diagram, metadata, byId }
}

const renderSvg = (ui: React.ReactElement) => {
  const diagram = createDiagramStore(new Y.Doc())
  return render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      {ui}
    </DiagramStoreContext.Provider>
  )
}

describe("agentic task canvas", () => {
  it("the bot replaces the type icon and the reflection marker replaces the loop", () => {
    const { container } = renderSvg(
      <BPMNTaskNodeSVG
        id="t"
        width={160}
        height={67}
        data={{
          name: "Check",
          taskType: "user",
          marker: "loop",
          isAgentic: true,
          reflectionMode: "self",
        } as never}
      />
    )
    expect(container.querySelector('[data-testid="agentic-bot-icon"]')).not.toBeNull()
    // The user-task glyph (head circle) and the loop arc are gone.
    expect(container.querySelector("circle")).toBeNull()
    expect(container.querySelector('path[d^="M7,3 A"]')).toBeNull()
    const marker = container.querySelector('[data-testid="bpmn-reflection-marker"]')!
    expect(marker.textContent).toBe("s")
    expect(marker.getAttribute("x")).toBe(String(160 / 2 - 8))
    expect(marker.getAttribute("y")).toBe(String(67 - 25))
  })

  it("an agentic task without reflection draws no bottom marker", () => {
    const { container } = renderSvg(
      <BPMNTaskNodeSVG
        id="t"
        width={160}
        height={60}
        data={{ name: "Do", taskType: "default", marker: "loop", isAgentic: true } as never}
      />
    )
    expect(container.querySelector('[data-testid="bpmn-reflection-marker"]')).toBeNull()
    expect(container.querySelector('path[d^="M7,3 A"]')).toBeNull()
  })

  it("a plain task keeps its type icon and marker", () => {
    const { container } = renderSvg(
      <BPMNTaskNodeSVG
        id="t"
        width={160}
        height={60}
        data={{ name: "Do", taskType: "user", marker: "loop" } as never}
      />
    )
    expect(container.querySelector('[data-testid="agentic-bot-icon"]')).toBeNull()
    expect(container.querySelector("circle")).not.toBeNull()
    expect(container.querySelector('path[d^="M7,3 A"]')).not.toBeNull()
  })

  it("min height floor matches develop (39, or 67 with reflection)", () => {
    expect(agenticTaskMinHeight({})).toBe(0)
    expect(agenticTaskMinHeight({ isAgentic: true, reflectionMode: "none" })).toBe(39)
    expect(agenticTaskMinHeight({ isAgentic: true, reflectionMode: "cross" })).toBe(67)
  })
})

describe("agentic lane canvas", () => {
  it("draws bot, role badge, trust score and copies", () => {
    const { container } = renderSvg(
      <BPMNSwimlaneNodeSVG
        id="l"
        width={560}
        height={150}
        data={{ name: "Coder", isAgentic: true, role: "supervision", trustScore: 82, multiplicity: 3 } as never}
      />
    )
    const markers = container.querySelector('[data-testid="agentic-lane-markers"]') as HTMLElement
    expect(markers.querySelector('[data-testid="agentic-bot-icon"]')).not.toBeNull()
    const texts = Array.from(markers.querySelectorAll("text")).map((t) => t.textContent)
    expect(texts).toEqual(["Sv", "82", "×3"])
  })

  it("hides copies at 1 and draws nothing for a plain lane", () => {
    const one = renderSvg(
      <BPMNSwimlaneNodeSVG
        id="l"
        width={560}
        height={150}
        data={{ name: "A", isAgentic: true, role: "solution", trustScore: 0, multiplicity: 1 } as never}
      />
    )
    expect(Array.from(one.container.querySelectorAll('[data-testid="agentic-lane-markers"] text')).map((t) => t.textContent)).toEqual(["S", "0"])
    cleanup()
    const plain = renderSvg(
      <BPMNSwimlaneNodeSVG id="l" width={560} height={150} data={{ name: "A" } as never} />
    )
    expect(plain.container.querySelector('[data-testid="agentic-lane-markers"]')).toBeNull()
  })

  it("badges legacy and custom roles", () => {
    expect(laneRoleBadge("manager")).toBe("Sv")
    expect(laneRoleBadge("worker")).toBe("S")
    expect(laneRoleBadge("reviewer")).toBe("RE")
    expect(laneRoleBadge(undefined)).toBe("S")
  })
})

describe("task popover", () => {
  it("hides the agentic controls without the agentic perspective", () => {
    setup(<BPMNTaskEditPopover elementId="task" />, [pool, lane("laneA", 0), task()], false)
    expect(screen.queryByLabelText("Agentic")).toBeNull()
  })

  it("switching agentic on writes develop's fields, off strips them but keeps the agent link", () => {
    const { byId } = setup(<BPMNTaskEditPopover elementId="task" />, [
      pool,
      lane("laneA", 0),
      task({ agentDiagramRef: "agent-1" }),
    ])
    expect(byId("task").data).not.toHaveProperty("isAgentic")
    fireEvent.click(screen.getByLabelText("Agentic"))
    expect(byId("task").data).toMatchObject({ isAgentic: true, reflectionMode: "none", trustScore: 0 })
    fireEvent.click(screen.getByLabelText("Agentic"))
    const data = byId("task").data
    for (const key of ["isAgentic", "reflectionMode", "trustScore", "reflectionReviewerLaneId"]) {
      expect(data).not.toHaveProperty(key)
    }
    expect(data.agentDiagramRef).toBe("agent-1")
  })

  it("a reflection mode grows a short task to the marker floor", () => {
    const { byId } = setup(<BPMNTaskEditPopover elementId="task" />, [
      pool,
      lane("laneA", 0),
      task({ isAgentic: true, reflectionMode: "none", trustScore: 0 }),
    ])
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Reflection" }))
    fireEvent.click(screen.getByRole("option", { name: "Self-reflection" }))
    expect(byId("task").data.reflectionMode).toBe("self")
    expect(byId("task").height).toBe(67)
  })

  it("offers other agentic lanes as cross-reflection reviewers", () => {
    setup(<BPMNTaskEditPopover elementId="task" />, [
      pool,
      lane("laneA", 0, { isAgentic: true }),
      lane("Reviewer", 120, { isAgentic: true }),
      lane("Human", 240),
      task({ isAgentic: true, reflectionMode: "cross", trustScore: 0 }),
    ])
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Reviewer agent" }))
    const options = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)
    expect(options).toEqual(["(Unspecified)", "Reviewer"])
  })

  it("clamps the trust score", () => {
    const { byId } = setup(<BPMNTaskEditPopover elementId="task" />, [
      pool,
      lane("laneA", 0),
      task({ isAgentic: true, reflectionMode: "none", trustScore: 0 }),
    ])
    fireEvent.change(screen.getByLabelText("Trust score (0-100)"), { target: { value: "250" } })
    expect(byId("task").data.trustScore).toBe(100)
    fireEvent.change(screen.getByLabelText("Trust score (0-100)"), { target: { value: "abc" } })
    expect(byId("task").data.trustScore).toBe(0)
  })
})

describe("lane popover", () => {
  const laneNodes = () => [
    pool,
    lane("laneA", 0),
    lane("laneB", 120),
    { ...task({}, "laneA"), position: { x: 35, y: 20 } },
  ]

  it("is the registered inspector for lanes", () => {
    expect(resolveElementInspector("bpmnSwimlane", "edit")).toBe(BPMNSwimlaneEditPopover)
  })

  it("moves a lane down and back up", () => {
    const { byId } = setup(<BPMNSwimlaneEditPopover elementId="laneA" />, laneNodes())
    expect(screen.getByLabelText("Move lane up")).toBeDisabled()
    fireEvent.click(screen.getByLabelText("Move lane down"))
    expect(byId("laneA").position.y).toBe(120)
    expect(byId("laneB").position.y).toBe(0)
    expect(screen.getByLabelText("Move lane down")).toBeDisabled()
    fireEvent.click(screen.getByLabelText("Move lane up"))
    expect(byId("laneA").position.y).toBe(0)
  })

  it("deletes the lane, merging its content into the neighbour", () => {
    const { diagram, byId } = setup(<BPMNSwimlaneEditPopover elementId="laneA" />, laneNodes())
    fireEvent.click(screen.getByLabelText("Delete lane"))
    expect(diagram.getState().nodes.some((n) => n.id === "laneA")).toBe(false)
    expect(byId("task").parentId).toBe("laneB")
  })

  it("hides the agentic controls without the agentic perspective", () => {
    setup(<BPMNSwimlaneEditPopover elementId="laneA" />, laneNodes(), false)
    expect(screen.queryByLabelText("Agentic")).toBeNull()
  })

  it("agentic on: defaults, children leave the wider header, one undo step", () => {
    const { diagram, byId } = setup(<BPMNSwimlaneEditPopover elementId="laneA" />, laneNodes())
    fireEvent.click(screen.getByLabelText("Agentic"))
    expect(byId("laneA").data).toMatchObject({ isAgentic: true, role: "solution", trustScore: 0, multiplicity: 1 })
    expect(byId("task").position.x).toBe(60)
    expect(diagram.getState().undoManager!.undoStack).toHaveLength(1)
    act(() => {
      diagram.getState().undo()
      diagram.getState().updateNodesFromYjs()
    })
    expect(byId("laneA").data).not.toHaveProperty("isAgentic")
    expect(byId("task").position.x).toBe(35)
  })

  it("agentic off strips the agentic keys but keeps the agent link", () => {
    const { byId } = setup(<BPMNSwimlaneEditPopover elementId="laneA" />, [
      pool,
      lane("laneA", 0, { isAgentic: true, role: "supervision", trustScore: 9, multiplicity: 2, agentDiagramRef: "a1" }),
    ])
    fireEvent.click(screen.getByLabelText("Agentic"))
    const data = byId("laneA").data
    for (const key of ["isAgentic", "role", "trustScore", "multiplicity"]) {
      expect(data).not.toHaveProperty(key)
    }
    expect(data.agentDiagramRef).toBe("a1")
  })

  it("edits role (with presets), trust score and copies", () => {
    const { byId } = setup(<BPMNSwimlaneEditPopover elementId="laneA" />, [
      pool,
      lane("laneA", 0, { isAgentic: true, role: "manager", trustScore: 0, multiplicity: 1 }),
    ])
    // A legacy role shows as its current preset.
    expect(screen.getByLabelText("Role")).toHaveValue("supervision")
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "code reviewer" } })
    expect(byId("laneA").data.role).toBe("code reviewer")
    fireEvent.click(screen.getByRole("button", { name: "Preset" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Solution" }))
    expect(byId("laneA").data.role).toBe("solution")
    fireEvent.change(screen.getByLabelText("Copies (≥1)"), { target: { value: "0" } })
    expect(byId("laneA").data.multiplicity).toBe(1)
    fireEvent.change(screen.getByLabelText("Copies (≥1)"), { target: { value: "4" } })
    expect(byId("laneA").data.multiplicity).toBe(4)
    fireEvent.change(screen.getByLabelText("Trust score (0-100)"), { target: { value: "-5" } })
    expect(byId("laneA").data.trustScore).toBe(0)
  })

  it("never rewrites a custom role while typing", () => {
    expect(displayLaneRole("code ")).toBe("code ")
    expect(displayLaneRole("")).toBe("")
    expect(displayLaneRole("worker")).toBe("solution")
    expect(displayLaneRole(undefined)).toBe("solution")
  })
})
