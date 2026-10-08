import { afterEach, describe, it, expect } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Edge, Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext, PopoverStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createPopoverStore } from "@/store/popoverStore"
import { diagramBridge } from "@/services/diagramBridge"
import { AgentDiagramEdgeEditPanel } from "@/components/inspectors/agentDiagram/AgentDiagramEdgeEditPanel"
import { AgentIntentEditPanel } from "@/components/inspectors/agentDiagram/AgentIntentEditPanel"
import { renameIntentInTransitions } from "@/components/inspectors/agentDiagram/agentComponentLists"

/**
 * Agent review fixes (2026-10-06): a transition naming an intent that no
 * longer exists is flagged in its inspector, renaming an (on-canvas)
 * intent carries its transitions along, and Enter in a training phrase
 * adds and focuses the next row.
 */

const transition = (intentName: string): Edge => ({
  id: "t1",
  type: "AgentStateTransition" as Edge["type"],
  source: "s1",
  target: "s2",
  data: {
    transitionType: "predefined",
    predefined: { predefinedType: "when_intent_matched", intentName },
  },
})

const renderWith = (ui: React.ReactElement, nodes: Node[], edges: Edge[]) => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setNodes(nodes)
  store.getState().setEdges(edges)
  render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      <PopoverStoreContext.Provider value={createPopoverStore()}>
        {ui}
      </PopoverStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return store
}

afterEach(() => diagramBridge.setAgentIntents([]))

describe("renameIntentInTransitions", () => {
  it("re-points matching intent transitions and leaves others alone", () => {
    const other: Edge = {
      ...transition("bye"),
      id: "t2",
    }
    const auto: Edge = {
      id: "t3",
      source: "a",
      target: "b",
      data: { predefined: { predefinedType: "auto", intentName: "greet" } },
    }
    const next = renameIntentInTransitions(
      [transition("greet"), other, auto],
      "greet",
      "hello"
    )
    expect(
      (next[0].data as { predefined: { intentName: string } }).predefined
        .intentName
    ).toBe("hello")
    expect(next[1]).toBe(other)
    expect(next[2]).toBe(auto)
  })

  it("returns the same array when nothing references the old name", () => {
    const edges = [transition("bye")]
    expect(renameIntentInTransitions(edges, "greet", "hello")).toBe(edges)
  })
})

describe("transition inspector: missing intent", () => {
  it("flags an intent that is not defined", () => {
    diagramBridge.setAgentIntents([{ name: "hello" }])
    renderWith(<AgentDiagramEdgeEditPanel elementId="t1" />, [], [
      transition("greet"),
    ])
    expect(screen.getByRole("alert").textContent).toContain('"greet"')
    expect(screen.getByRole("combobox").textContent).toContain("greet (missing)")
  })

  it("stays quiet for an existing intent", () => {
    diagramBridge.setAgentIntents([{ name: "greet" }])
    renderWith(<AgentDiagramEdgeEditPanel elementId="t1" />, [], [
      transition("greet"),
    ])
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByRole("combobox").textContent).toBe("greet")
  })
})

describe("transition inspector: switching to custom", () => {
  it("a predefined transition becomes a WildcardEvent custom one (develop parity)", () => {
    const store = renderWith(<AgentDiagramEdgeEditPanel elementId="t1" />, [], [
      transition("greet"),
    ])
    fireEvent.click(screen.getByRole("button", { name: "Custom transition" }))
    const edge = store.getState().edges.find((e) => e.id === "t1")!
    expect((edge.data as { custom: { event: string } }).custom.event).toBe(
      "WildcardEvent"
    )
  })
})

describe("intent inspector", () => {
  const intent = (phrases: { id: string; name: string }[] = []): Node => ({
    id: "i1",
    type: "AgentIntent",
    position: { x: 0, y: 0 },
    data: { name: "greet", training_phrases: phrases },
  })

  it("renaming the intent updates the transitions that use it", () => {
    const store = renderWith(<AgentIntentEditPanel elementId="i1" />, [intent()], [
      transition("greet"),
    ])
    fireEvent.change(screen.getByLabelText("Intent Name"), {
      target: { value: "hello" },
    })
    const edge = store.getState().edges.find((e) => e.id === "t1")!
    expect(
      (edge.data as { predefined: { intentName: string } }).predefined.intentName
    ).toBe("hello")
  })

  it("Enter in a training phrase adds a row and focuses it", () => {
    const store = renderWith(
      <AgentIntentEditPanel elementId="i1" />,
      [intent([{ id: "p1", name: "hi" }])],
      []
    )
    fireEvent.keyDown(screen.getByDisplayValue("hi"), { key: "Enter" })
    const phrases = (
      store.getState().nodes[0].data as { training_phrases: unknown[] }
    ).training_phrases
    expect(phrases).toHaveLength(2)
    const inputs = screen.getAllByPlaceholderText("e.g. hello")
    expect(inputs).toHaveLength(2)
    expect(document.activeElement).toBe(inputs[1])
  })
})
