import { describe, it, expect } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Edge } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import {
  StateMachineDiagramEdgeEditPanel,
  toParamRows,
} from "@/components/inspectors/stateMachineDiagram/StateMachineDiagramEdgeEditPanel"

/**
 * Wave-3 SM-1 — `StateTransition` inspector parity with develop
 * (`uml-state-diagram/uml-state-transition/uml-state-transition-update.tsx`):
 *
 *   1. Guard field writes `data.guard`,
 *   2. Add appends a parameter row (persisted as an ordered array),
 *   3. per-row trash removes exactly that index,
 *   4. the trash button is hidden while only one row exists,
 *   5. legacy single-string params render as ONE row, unsplit.
 */

const transitionEdge = (over: Partial<Edge> = {}): Edge => ({
  id: "edge-1",
  type: "StateTransition" as Edge["type"],
  source: "state-a",
  sourceHandle: "right",
  target: "state-b",
  targetHandle: "left",
  data: {},
  ...over,
})

const renderPanel = (edges: Edge[], elementId = "edge-1") => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setEdges(edges)
  const utils = render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      <StateMachineDiagramEdgeEditPanel elementId={elementId} />
    </DiagramStoreContext.Provider>
  )
  return { store, ...utils }
}

const getData = (store: StoreApi<DiagramStore>) =>
  store.getState().edges.find((e) => e.id === "edge-1")!.data as {
    name?: string
    guard?: string
    params?: string[]
  }

describe("StateMachineDiagramEdgeEditPanel — guard", () => {
  it("writes guard text to data.guard", () => {
    const { store } = renderPanel([transitionEdge()])
    const guard = screen.getByPlaceholderText("Guard expression")
    fireEvent.change(guard, { target: { value: "x > 1" } })
    expect(getData(store).guard).toBe("x > 1")
  })

  it("shows the stored guard", () => {
    renderPanel([transitionEdge({ data: { guard: "count == 0" } })])
    expect(screen.getByDisplayValue("count == 0")).toBeDefined()
  })
})

describe("StateMachineDiagramEdgeEditPanel — parameters", () => {
  it("seeds one empty row without persisting it", () => {
    const { store } = renderPanel([transitionEdge()])
    expect(screen.getByPlaceholderText("Parameter 1")).toBeDefined()
    expect(getData(store).params).toBeUndefined()
  })

  it("typing into a row persists the ordered array", () => {
    const { store } = renderPanel([transitionEdge()])
    fireEvent.change(screen.getByPlaceholderText("Parameter 1"), {
      target: { value: "{60}" },
    })
    expect(getData(store).params).toEqual(["{60}"])
  })

  it("Add appends a row", () => {
    const { store } = renderPanel([
      transitionEdge({ data: { params: ["a"] } }),
    ])
    fireEvent.click(screen.getByRole("button", { name: "+ add" }))
    expect(getData(store).params).toEqual(["a", ""])
    expect(screen.getByPlaceholderText("Parameter 2")).toBeDefined()
  })

  it("trash removes exactly the clicked row", () => {
    const { store } = renderPanel([
      transitionEdge({ data: { params: ["a", "b", "c"] } }),
    ])
    fireEvent.click(
      screen.getByRole("button", { name: "Remove parameter 2" })
    )
    expect(getData(store).params).toEqual(["a", "c"])
  })

  it("hides the trash button while only one row exists", () => {
    renderPanel([transitionEdge({ data: { params: ["a"] } })])
    expect(
      screen.queryByRole("button", { name: /Remove parameter/ })
    ).toBeNull()
  })

  it("renders legacy single-string params as ONE row, unsplit", () => {
    // A single v3 param may legally contain commas.
    renderPanel([transitionEdge({ data: { params: "a, b" as never } })])
    const row = screen.getByPlaceholderText("Parameter 1") as HTMLInputElement
    expect(row.value).toBe("a, b")
    expect(screen.queryByPlaceholderText("Parameter 2")).toBeNull()
  })

  it("renders legacy dict params in key order", () => {
    renderPanel([
      transitionEdge({
        data: { params: { "1": "b", "0": "a" } as never },
      }),
    ])
    expect(
      (screen.getByPlaceholderText("Parameter 1") as HTMLInputElement).value
    ).toBe("a")
    expect(
      (screen.getByPlaceholderText("Parameter 2") as HTMLInputElement).value
    ).toBe("b")
  })

  it("trash disappears once a removal leaves a single row", () => {
    const { store } = renderPanel([
      transitionEdge({ data: { params: ["a", "b"] } }),
    ])
    fireEvent.click(
      screen.getByRole("button", { name: "Remove parameter 2" })
    )
    expect(getData(store).params).toEqual(["a"])
    // Develop parity: the last remaining row cannot be trashed.
    expect(
      screen.queryByRole("button", { name: /Remove parameter/ })
    ).toBeNull()
  })
})

describe("toParamRows", () => {
  it("normalizes array / string / dict / absent params", () => {
    expect(toParamRows(["a", "b"])).toEqual(["a", "b"])
    expect(toParamRows("{60}")).toEqual(["{60}"])
    expect(toParamRows({ "1": "b", "0": "a" })).toEqual(["a", "b"])
    expect(toParamRows(undefined)).toEqual([])
  })
})
