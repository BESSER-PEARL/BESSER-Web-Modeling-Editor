import { describe, it, expect } from "vitest"
import { act, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import { useReactiveEdge, useReactiveNode } from "@/hooks/useReactiveElement"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { BPMNTaskEditPopover } from "@/components/popovers/bpmnDiagram/BPMNTaskEditPopover"

/**
 * Upstream Apollon `usePopoverAnchor` + `useReactiveNode` / `useReactiveEdge`.
 *  - A popover anchor read from `ref.current` during render is still null on
 *    the render that mounts it, so the popover had no anchor until some
 *    unrelated re-render. The callback-ref state hook re-renders on mount.
 *  - Popovers read their element reactively, so undo / external edits show
 *    up immediately instead of going stale.
 */

describe("usePopoverAnchor", () => {
  it("exposes the anchor element right after it mounts (no extra render needed)", () => {
    const Probe = () => {
      const [anchorEl, anchorRef] = usePopoverAnchor<HTMLDivElement>()
      return (
        <>
          <div ref={anchorRef} data-testid="anchor" />
          <span data-testid="state">
            {anchorEl ? anchorEl.getAttribute("data-testid") : "none"}
          </span>
        </>
      )
    }
    render(<Probe />)
    expect(screen.getByTestId("state").textContent).toBe("anchor")
  })

  it("drops the anchor when the element unmounts", () => {
    const Probe = ({ show }: { show: boolean }) => {
      const [anchorEl, anchorRef] = usePopoverAnchor<HTMLDivElement>()
      return (
        <>
          {show && <div ref={anchorRef} />}
          <span data-testid="state">{anchorEl ? "set" : "none"}</span>
        </>
      )
    }
    const { rerender } = render(<Probe show />)
    expect(screen.getByTestId("state").textContent).toBe("set")
    rerender(<Probe show={false} />)
    expect(screen.getByTestId("state").textContent).toBe("none")
  })
})

const withStore = (store: StoreApi<DiagramStore>, ui: React.ReactNode) => (
  <ReactFlowProvider>
    <DiagramStoreContext.Provider value={store}>{ui}</DiagramStoreContext.Provider>
  </ReactFlowProvider>
)

describe("useReactiveNode / useReactiveEdge", () => {
  it("re-render on store changes (undo / external edit)", () => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes([
      { id: "a", type: "class", position: { x: 0, y: 0 }, data: { name: "A" } },
    ])
    store.getState().setEdges([
      { id: "e", source: "a", target: "a", data: { name: "one" } },
    ])
    const Probe = () => {
      const node = useReactiveNode("a")
      const edge = useReactiveEdge("e")
      return (
        <span data-testid="probe">
          {String(node?.data.name)}/{String(edge?.data?.name)}
        </span>
      )
    }
    render(withStore(store, <Probe />))
    expect(screen.getByTestId("probe").textContent).toBe("A/one")

    act(() => {
      store
        .getState()
        .setNodes((nodes) =>
          nodes.map((n) => ({ ...n, data: { ...n.data, name: "A2" } }))
        )
      store
        .getState()
        .setEdges((edges) =>
          edges.map((e) => ({ ...e, data: { ...e.data, name: "two" } }))
        )
    })
    expect(screen.getByTestId("probe").textContent).toBe("A2/two")
  })

  it("covers an edge kept out of React Flow (edge-anchored ClassLinkRel)", () => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes([
      { id: "c1", position: { x: 0, y: 0 }, data: {} },
      { id: "c2", position: { x: 0, y: 0 }, data: {} },
      { id: "ac", position: { x: 0, y: 0 }, data: {} },
    ])
    store.getState().setEdges([
      { id: "assoc", source: "c1", target: "c2", data: {} },
      { id: "link", type: "ClassLinkRel", source: "assoc", target: "ac" },
    ])
    const Probe = () => (
      <span data-testid="probe">{useReactiveEdge("link")?.source}</span>
    )
    render(withStore(store, <Probe />))
    expect(screen.getByTestId("probe").textContent).toBe("assoc")
  })

  it("a BPMN popover follows an external data change without remounting", () => {
    const store = createDiagramStore(new Y.Doc())
    const task: Node = {
      id: "t",
      type: "BPMNTask",
      position: { x: 0, y: 0 },
      width: 160,
      height: 60,
      data: { name: "Review", taskType: "default" },
    }
    store.getState().setNodes([task])
    render(withStore(store, <BPMNTaskEditPopover elementId="t" />))
    expect(screen.getByText("Task")).toBeInTheDocument()

    act(() => {
      store
        .getState()
        .setNodes([{ ...task, data: { ...task.data, taskType: "user" } }])
    })
    expect(screen.getByText("User Task")).toBeInTheDocument()
  })
})
