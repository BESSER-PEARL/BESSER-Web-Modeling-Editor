import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Node } from "@xyflow/react"
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
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useSelectionForCopyPaste } from "@/hooks/useSelectionForCopyPaste"
import { PropertiesPanel } from "@/components/propertiesPanel/PropertiesPanel"
import { registerInspector } from "@/components/inspectors/registry"
import { DraggableGhost } from "@/components/DraggableGhost"
import { dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"
import { revealShift } from "@/App"
import {
  centerPastedOn,
  nextFreeCopyName,
  withNumberedPaletteName,
  withUniqueCopyNames,
} from "@/utils/elementNaming"
import { withMandatoryNNDefaults } from "@/utils/nnMandatoryDefaults"

// Stub inspectors: a name field first, like the real class / state panels.
const StubInspector = ({ elementId }: { elementId: string }) => (
  <div data-testid={`inspector-${elementId}`}>
    <input aria-label="Enter node name" defaultValue={elementId} />
    <input aria-label="Description" />
  </div>
)
registerInspector("class", "edit", StubInspector)

const classNode = (id: string, x = 0, y = 0, selected = false): Node => ({
  id,
  type: "class",
  position: { x, y },
  width: 160,
  height: 100,
  measured: { width: 160, height: 100 },
  selected,
  data: { name: id, attributes: [], methods: [] },
})

const setup = (ui: React.ReactElement, nodes: Node[] = []) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  const popover = createPopoverStore()
  act(() => {
    diagram.getState().setNodes(nodes)
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

const Shortcuts = () => {
  useKeyboardShortcuts()
  return null
}

const escape = (target: EventTarget) => {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

const mountElement = (html: string, wrapperClass?: string): HTMLElement => {
  const host = document.createElement("div")
  if (wrapperClass) host.className = wrapperClass
  host.innerHTML = html
  document.body.appendChild(host)
  return host.firstElementChild as HTMLElement
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

describe("Escape belongs to the canvas only while focus is on it", () => {
  // Live regression: the document-level capture listener preventDefault()ed
  // every Escape, so Radix menus (File / Generate / Help) and the webapp's
  // assistant drawer no longer closed on Esc.
  it("is not swallowed in a host menu or drawer, and leaves the selection", () => {
    const { diagram } = setup(<Shortcuts />, [classNode("A", 0, 0, true)])
    const menuItem = mountElement(
      '<div role="menu"><div role="menuitem" tabindex="-1">Open</div></div>'
    ).firstElementChild as HTMLElement
    const drawerButton = mountElement("<button>Send</button>", "assistant-drawer")

    expect(escape(menuItem).defaultPrevented).toBe(false)
    expect(escape(drawerButton).defaultPrevented).toBe(false)
    expect(diagram.getState().selectedElementIds).toEqual(["A"])
  })

  it("from the page body it clears the selection without preventDefault", () => {
    const { diagram } = setup(<Shortcuts />, [classNode("A", 0, 0, true)])
    expect(escape(document.body).defaultPrevented).toBe(false)
    expect(diagram.getState().selectedElementIds).toEqual([])
  })

  it("closes the open inspector first, then clears the selection", () => {
    const { diagram, popover } = setup(<Shortcuts />, [classNode("A", 0, 0, true)])
    act(() => popover.getState().setPopOverElementId("A"))

    // Consumed, so a host drawer does not close on the same press.
    expect(escape(document.body).defaultPrevented).toBe(true)
    expect(popover.getState().popoverElementId).toBeNull()
    expect(diagram.getState().selectedElementIds).toEqual(["A"])

    expect(escape(document.body).defaultPrevented).toBe(false)
    expect(diagram.getState().selectedElementIds).toEqual([])
  })

  it("inside the properties panel (even in its name field) closes the panel", () => {
    const { popover } = setup(<Shortcuts />, [classNode("A", 0, 0, true)])
    act(() => popover.getState().setPopOverElementId("A"))
    const field = mountElement("<input />", "besser-properties-panel")
    const onBlur = vi.fn()
    field.addEventListener("blur", onBlur)
    field.focus()

    escape(field)
    expect(popover.getState().popoverElementId).toBeNull()
    // Blurred first, so fields that commit on blur keep the typed value.
    expect(onBlur).toHaveBeenCalled()
  })

  it("an open select inside the panel keeps Escape for itself", () => {
    const { popover } = setup(<Shortcuts />, [classNode("A", 0, 0, true)])
    act(() => popover.getState().setPopOverElementId("A"))
    const combo = mountElement(
      '<div role="combobox" aria-expanded="true" tabindex="0"></div>',
      "besser-properties-panel"
    )
    escape(combo)
    expect(popover.getState().popoverElementId).toBe("A")
  })
})

describe("properties panel behaviour", () => {
  it("an explicit open focuses and selects the element's name field", () => {
    const { popover } = setup(<PropertiesPanel />, [classNode("A")])
    act(() => popover.getState().setPopOverElementId("A"))
    const name = screen.getByLabelText("Enter node name") as HTMLInputElement
    expect(document.activeElement).toBe(name)
    expect(name.selectionStart).toBe(0)
    expect(name.selectionEnd).toBe(name.value.length)
  })

  it("follows the selection while open, without taking focus from the canvas", () => {
    const { diagram, popover } = setup(<PropertiesPanel />, [
      classNode("A"),
      classNode("B", 300),
    ])
    act(() => popover.getState().setPopOverElementId("A"))
    act(() => (document.activeElement as HTMLElement).blur())

    act(() => diagram.getState().setSelectedElementsId(["B"]))
    expect(popover.getState().popoverElementId).toBe("B")
    expect(screen.getByTestId("inspector-B")).toBeInTheDocument()
    expect(document.activeElement).toBe(document.body)

    // A multi-selection keeps the current target.
    act(() => diagram.getState().setSelectedElementsId(["A", "B"]))
    expect(popover.getState().popoverElementId).toBe("B")
  })

  it("does not open from a selection change while closed", () => {
    const { diagram, popover } = setup(<PropertiesPanel />, [classNode("A")])
    act(() => diagram.getState().setSelectedElementsId(["A"]))
    expect(popover.getState().popoverElementId).toBeNull()
  })
})

describe("revealShift (pan the edited element out from under the panel)", () => {
  it("is zero for a visible element", () => {
    expect(revealShift({ x: 100, y: 100, width: 50, height: 50 }, 800, 600)).toEqual({
      dx: 0,
      dy: 0,
    })
  })
  it("moves an element cut off on the right back inside with a margin", () => {
    expect(revealShift({ x: 750, y: 100, width: 100, height: 50 }, 800, 600, 24)).toEqual({
      dx: -74,
      dy: 0,
    })
  })
  it("aligns an element wider than the canvas to the left", () => {
    expect(revealShift({ x: 300, y: 0, width: 900, height: 50 }, 800, 600, 24).dx).toBe(-276)
  })
})

describe("element naming", () => {
  it("palette classes / agent states are numbered", () => {
    const existing = [classNode("x1")].map((n) => ({ ...n, data: { name: "Class1" } }))
    const node = { ...classNode("new"), data: { name: "Class" } }
    expect(withNumberedPaletteName(node, []).data.name).toBe("Class1")
    expect(withNumberedPaletteName(node, existing).data.name).toBe("Class2")
    const state = { id: "s", type: "AgentState", position: { x: 0, y: 0 }, data: { name: "AgentState" } }
    expect(withNumberedPaletteName(state, []).data.name).toBe("AgentState1")
    // Other types keep their default name.
    const note = { id: "c", type: "Comment", position: { x: 0, y: 0 }, data: { name: "Comment" } }
    expect(withNumberedPaletteName(note, []).data.name).toBe("Comment")
  })

  it("copies get the next free name; a free name (cut + paste) is kept", () => {
    expect(nextFreeCopyName("Book", new Set(["Book"]))).toBe("Book2")
    expect(nextFreeCopyName("Book", new Set(["Book", "Book2"]))).toBe("Book3")
    expect(nextFreeCopyName("Class1", new Set(["Class1"]))).toBe("Class2")
    expect(nextFreeCopyName("Book", new Set())).toBe("Book")
    const pasted = withUniqueCopyNames(
      [classNode("p1"), classNode("p2")].map((n) => ({ ...n, data: { name: "Book" } })),
      [{ ...classNode("o"), data: { name: "Book" } }]
    )
    expect(pasted.map((n) => n.data.name)).toEqual(["Book2", "Book3"])
  })
})

describe("palette insert writes creation-time data", () => {
  const insert = (type: string, diagramType: UMLDiagramType, times = 1) => {
    const config = dropElementConfigs[diagramType].find((c) => c.type === type)!
    const ctx = setup(
      <DraggableGhost dropElementConfig={config}>
        <div>item</div>
      </DraggableGhost>
    )
    const canvas = document.createElement("div")
    canvas.id = `react-flow-library-${ctx.diagram.getState().diagramId}`
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }) as DOMRect
    document.body.appendChild(canvas)
    const item = screen.getByRole("button")
    for (let i = 0; i < times; i++) fireEvent.keyDown(item, { key: "Enter" })
    return ctx.diagram.getState().nodes
  }

  it("classes inserted from the palette are numbered", () => {
    const nodes = insert("class", UMLDiagramType.ClassDiagram, 2)
    expect(nodes.map((n) => n.data.name)).toEqual(["Class1", "Class2"])
  })

  // Live repro: a freshly dropped Conv2D layer carried only `name`; its
  // mandatory kernel_dim / out_channels / ... appeared only once its panel
  // was opened, so validation failed for layers never opened.
  it("an NN layer gets its mandatory attribute defaults at creation", () => {
    const [layer] = insert("Conv2DLayer", UMLDiagramType.NNDiagram)
    const attributes = layer.data.attributes as Record<string, unknown>
    expect(attributes).toEqual(
      withMandatoryNNDefaults("Conv2DLayer", {
        name: "conv2d_layer",
        attributes: { name: "conv2d_layer" },
      }).attributes
    )
    expect(attributes.kernel_dim).toBe("[3, 3]")
    expect(Object.keys(attributes).length).toBeGreaterThan(1)
  })
})

describe("paste placement", () => {
  it("centres the pasted roots on the target and moves edge points along", () => {
    const parent = classNode("P", 0, 0)
    const child = { ...classNode("C", 10, 10), parentId: "P" }
    const { nodes, edges } = centerPastedOn(
      [parent, child],
      [{ id: "e", source: "P", target: "C", data: { points: [{ x: 5, y: 5 }] } }],
      { x: 1000, y: 500 }
    )
    // 160 x 100 root centred on (1000, 500).
    expect(nodes[0].position).toEqual({ x: 920, y: 450 })
    // Children are parent-relative and stay put.
    expect(nodes[1].position).toEqual({ x: 10, y: 10 })
    expect(edges[0].data?.points).toEqual([{ x: 925, y: 455 }])
  })

  // Live repro: copy Book, scroll the view away, Ctrl+V: the copy landed at
  // +20/+20 of the original, off-screen.
  it("Ctrl+V pastes at the given anchor with a unique name", async () => {
    const clip = {
      nodes: [{ ...classNode("Book", 0, 0), data: { name: "Book" } }],
      edges: [],
      timestamp: 1,
    }
    vi.stubGlobal("isSecureContext", true)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: async () => JSON.stringify(clip), writeText: async () => {} },
    })
    let paste: ReturnType<typeof useSelectionForCopyPaste>["pasteElements"]
    const Host = () => {
      paste = useSelectionForCopyPaste().pasteElements
      return null
    }
    const { diagram } = setup(<Host />, [{ ...classNode("Book"), data: { name: "Book" } }])
    await act(async () => {
      await paste!(1, { x: 2000, y: 3000 })
    })
    const pasted = diagram.getState().nodes[1]
    expect(pasted.position).toEqual({ x: 1920, y: 2950 })
    expect(pasted.data.name).toBe("Book2")
    vi.unstubAllGlobals()
  })
})
