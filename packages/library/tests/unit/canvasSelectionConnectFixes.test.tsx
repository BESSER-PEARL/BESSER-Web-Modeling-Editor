import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import {
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type IsValidConnection,
  type Node,
} from "@xyflow/react"
import type { StoreApi } from "zustand"
import {
  AssessmentSelectionStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
  useDiagramStore,
} from "@/store/context"
import { createAssessmentSelectionStore } from "@/store/assessmentSelectionStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useSelectionForCopyPaste } from "@/hooks/useSelectionForCopyPaste"
import { useConnect } from "@/hooks/useConnect"
import { CustomControls } from "@/components/CustomControls"
import { StateInitialNode } from "@/nodes/stateMachineDiagram/StateInitialNode"
import { StateFinalNode } from "@/nodes/stateMachineDiagram/StateFinalNode"
import { canConnectEndpoints } from "@/utils/bpmnConstraints"
import { refusalReason } from "@/edges/connectRules"
import {
  clearConnectionNotice,
  markInvalidTarget,
  showConnectionNotice,
} from "@/edges/connectionNotice"
import { UMLDiagramType } from "@/types"
import { Locale } from "@/typings"

/**
 * Canvas fixes from the React Flow migration test round: selection (Escape,
 * multi-selection click), copy/paste without clipboard-read permission,
 * translated zoom controls, connection refusals and migrated state markers.
 */

const classNode = (id: string, x = 0, selected = false): Node => ({
  id,
  type: "class",
  position: { x, y: 0 },
  width: 160,
  height: 100,
  measured: { width: 160, height: 100 },
  selected,
  data: { name: id, attributes: [], methods: [] },
})

const setup = (
  ui: React.ReactElement,
  nodes: Node[] = [],
  {
    edges = [],
    diagramType,
    locale,
  }: { edges?: Edge[]; diagramType?: UMLDiagramType; locale?: Locale } = {}
) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  const popover = createPopoverStore()
  if (diagramType) metadata.getState().updateDiagramType(diagramType)
  if (locale) metadata.getState().setLocale(locale)
  act(() => {
    diagram.getState().setNodes(nodes)
    diagram.getState().setEdges(edges)
    diagram
      .getState()
      .setSelectedElementsId(nodes.filter((n) => n.selected).map((n) => n.id))
  })
  const utils = render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={popover}>
          <AssessmentSelectionStoreContext.Provider
            value={createAssessmentSelectionStore()}
          >
            <ReactFlowProvider>{ui}</ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { diagram, metadata, popover, ...utils }
}

/** A canvas wired to the diagram store, with the editor's shortcuts. */
const Canvas = ({ nodeTypes }: { nodeTypes?: Record<string, React.ComponentType<never>> }) => {
  useKeyboardShortcuts()
  const { nodes, edges, onNodesChange, onEdgesChange } = useDiagramStore((s) => s)
  return (
    <div style={{ width: 800, height: 600 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes as never}
      />
    </div>
  )
}

const keydown = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

const selected = (diagram: StoreApi<DiagramStore>) =>
  diagram.getState().nodes.filter((n) => n.selected).map((n) => n.id)

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

describe("Escape clears the selection", () => {
  // Live: Escape on a focused node cleared the selection in capture; the
  // browser then flushed React (discrete update) before React Flow's node
  // keydown handler ran, which saw the node unselected and selected it again.
  // jsdom runs no microtask checkpoint between listeners, so the test pins
  // the fix: the event never reaches React Flow's handler.
  it("from a focused node, without React Flow re-selecting it", () => {
    const { diagram, container } = setup(<Canvas />, [classNode("A", 0, true), classNode("B", 300, true)])
    const nodeEl = container.querySelector<HTMLElement>('.react-flow__node[data-id="A"]')!
    const reachedFlow = vi.fn()
    container.querySelector(".react-flow")!.addEventListener("keydown", reachedFlow)
    nodeEl.focus()
    keydown(nodeEl, "Escape")
    expect(selected(diagram as StoreApi<DiagramStore>)).toEqual([])
    expect(reachedFlow).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(nodeEl)
  })

  // Live: after a pane click focus sits on the host's focusable <main>.
  it("from a focusable container around the canvas", () => {
    const { diagram, container } = setup(
      <main tabIndex={-1}>
        <Canvas />
      </main>,
      [classNode("A", 0, true)]
    )
    const main = container.querySelector("main")!
    keydown(main, "Escape")
    expect(selected(diagram as StoreApi<DiagramStore>)).toEqual([])
  })
})

describe("keyboard listeners", () => {
  it("are not re-registered on a drag step", () => {
    const { diagram } = setup(<Canvas />, [classNode("A")])
    const spy = vi.spyOn(document, "addEventListener")
    act(() =>
      diagram.getState().onNodesChange([
        { id: "A", type: "position", position: { x: 40, y: 0 }, dragging: true },
      ])
    )
    expect(spy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0)
    spy.mockRestore()
  })
})

describe("copy / paste without clipboard-read permission", () => {
  const denyRead = () => {
    vi.stubGlobal("isSecureContext", true)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () => Promise.reject(new DOMException("denied", "NotAllowedError")),
        writeText: async () => {},
      },
    })
  }
  let api: ReturnType<typeof useSelectionForCopyPaste>
  const Host = () => {
    api = useSelectionForCopyPaste()
    return null
  }

  it("Ctrl+C then Ctrl+V pastes the in-memory copy", async () => {
    denyRead()
    const { diagram } = setup(<Host />, [classNode("Book", 0, true)])
    await act(async () => {
      await api.copySelectedElements()
    })
    let pasted = false
    await act(async () => {
      pasted = await api.pasteElements(1)
    })
    expect(pasted).toBe(true)
    expect(diagram.getState().nodes).toHaveLength(2)
  })

  it("Ctrl+X then Ctrl+V moves the selection instead of deleting it", async () => {
    denyRead()
    const { diagram } = setup(<Host />, [classNode("Cut", 0, true), classNode("Keep", 300)])
    await act(async () => {
      await api.cutSelectedElements()
    })
    expect(diagram.getState().nodes.map((n) => n.id)).toEqual(["Keep"])
    await act(async () => {
      await api.pasteElements(1)
    })
    expect(diagram.getState().nodes.map((n) => n.data.name)).toContain("Cut")
  })

  it("Ctrl+D duplicates with no clipboard at all", async () => {
    vi.stubGlobal("isSecureContext", false)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined })
    const { diagram } = setup(
      <>
        <Host />
        <Canvas />
      </>,
      [classNode("Dup", 0, true)]
    )
    keydown(document.body, "d", { ctrlKey: true })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(diagram.getState().nodes).toHaveLength(2)
  })
})

describe("canvas controls", () => {
  it("label zoom in / out / fit view in the editor's locale", () => {
    setup(<CustomControls />, [classNode("A")], { locale: Locale.de })
    expect(screen.getByRole("button", { name: "Vergrößern" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Verkleinern" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /zoom in/i })).toBeNull()
  })
})

describe("connection rules", () => {
  const smNodes = [
    { id: "s1", type: "State" },
    { id: "s2", type: "State" },
    { id: "init", type: "StateInitialNode" },
    { id: "final", type: "StateFinalNode" },
    { id: "code", type: "StateCodeBlock" },
    { id: "note", type: "comment" },
    { id: "agent", type: "AgentState" },
  ]
  const can = (s: string, t: string) => canConnectEndpoints(smNodes, s, t)

  it("refuse state machine transitions the backend drops", () => {
    expect(can("s1", "code")).toBe(false)
    expect(can("code", "s1")).toBe(false)
    expect(can("final", "s1")).toBe(false)
    expect(can("s1", "init")).toBe(false)
    expect(refusalReason(smNodes, "s1", "code")).toBe("stateCodeBlock")
    expect(refusalReason(smNodes, "final", "s1")).toBe("stateFinalOutgoing")
    expect(refusalReason(smNodes, "s1", "init")).toBe("stateInitialIncoming")
  })

  it("keep ordinary transitions, comments and the agent init edge", () => {
    expect(can("init", "s1")).toBe(true)
    expect(can("s1", "final")).toBe(true)
    expect(can("s1", "s2")).toBe(true)
    expect(can("note", "code")).toBe(true)
    expect(can("final", "note")).toBe(true)
    expect(can("agent", "init")).toBe(true)
  })

  // Live: end event -> task in one pool looked valid while dragging and was
  // then dropped silently.
  it("refuse a same-pool message-only BPMN pair while dragging", () => {
    let isValid: IsValidConnection | undefined
    const Host = () => {
      isValid = useConnect().isValidConnection
      return null
    }
    setup(
      <Host />,
      [
        { id: "p1", type: "bpmnPool", position: { x: 0, y: 0 }, data: {} },
        { id: "end", type: "bpmnEndEvent", parentId: "p1", position: { x: 0, y: 0 }, data: {} },
        { id: "task", type: "bpmnTask", parentId: "p1", position: { x: 0, y: 0 }, data: {} },
        { id: "start", type: "bpmnStartEvent", parentId: "p1", position: { x: 0, y: 0 }, data: {} },
      ] as Node[],
      { diagramType: UMLDiagramType.BPMN }
    )
    const conn = (source: string, target: string) =>
      isValid!({ source, target, sourceHandle: null, targetHandle: null })
    expect(conn("end", "task")).toBe(false)
    expect(conn("task", "start")).toBe(false)
    expect(conn("start", "task")).toBe(true)
  })
})

describe("connection notice", () => {
  it("is styled by class (danger token) and can be cleared", () => {
    const flow = document.createElement("div")
    flow.className = "react-flow"
    flow.innerHTML = '<div class="react-flow__node" data-id="n1"></div>'
    document.body.appendChild(flow)
    markInvalidTarget("n1")
    const node = flow.querySelector<HTMLElement>(".react-flow__node")!
    expect(node.classList.contains("besser-connect-target--invalid")).toBe(true)
    expect(node.style.outline).toBe("")
    markInvalidTarget(null)
    showConnectionNotice("Refused", { x: 10, y: 10 }, node)
    const notice = flow.querySelector<HTMLElement>(".besser-connection-notice")!
    expect(notice.style.background).toBe("")
    clearConnectionNotice()
    expect(flow.querySelector(".besser-connection-notice")).toBeNull()
  })
})

describe("state markers keep every handle id", () => {
  // Live: migrated v3 transitions name corner handles ("top-right", ...);
  // the markers hid them and React Flow dropped the edge.
  it.each([
    ["StateInitialNode", StateInitialNode],
    ["StateFinalNode", StateFinalNode],
  ])("%s renders the corner anchors", (type, Component) => {
    const { container } = setup(
      <Canvas nodeTypes={{ [type]: Component as never }} />,
      [
        {
          id: "m",
          type,
          position: { x: 0, y: 0 },
          width: 45,
          height: 45,
          data: {},
        } as Node,
      ],
      { diagramType: UMLDiagramType.StateMachineDiagram }
    )
    for (const id of ["top-right", "right-bottom", "bottom-left", "left-top"]) {
      expect(container.querySelector(`[data-handleid="${id}"]`)).not.toBeNull()
    }
  })
})
