import { Profiler } from "react"
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
import {
  DraggableGhost,
  getClickInsertPosition,
} from "@/components/DraggableGhost"
import { ColorButtons } from "@/components/ui/StyleEditor/ColorButtons"
import { dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"

/**
 * Canvas behaviour ported from develop's old editor (459bd19d, 2d5445ca,
 * a8eac70c): shortcut guards for focused controls, Shift-nudge, Ctrl+Y,
 * Enter-to-edit, palette click/keyboard insert (selects + cascades) and
 * named colour swatches.
 */

const classNode = (id: string, x: number, y: number, selected = false): Node => ({
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

const press = (
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {}
) =>
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
    )
  })

/** A focusable element appended to the page, optionally inside a wrapper. */
const mountElement = (
  html: string,
  wrapperClass?: string
): HTMLElement => {
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

describe("canvas keyboard shortcuts", () => {
  it("Backspace on a focused swatch / panel control does not delete the selection", () => {
    const { diagram } = setup(<Shortcuts />, [classNode("A", 0, 0, true)])

    const swatch = mountElement('<button aria-label="Red"></button>')
    press(swatch, "Backspace")
    const inPanel = mountElement("<span tabindex='0'>x</span>", "besser-properties-panel")
    press(inPanel, "Delete")
    const option = mountElement('<div role="option" tabindex="0">a</div>')
    press(option, "Backspace")

    expect(diagram.getState().nodes.map((n) => n.id)).toEqual(["A"])
  })

  it("Backspace from the page or a focused React Flow node deletes the selection", () => {
    const { diagram } = setup(<Shortcuts />, [
      classNode("A", 0, 0, true),
      classNode("B", 300, 0),
    ])
    // React Flow gives focusable nodes role="button"; that is the canvas, not a control.
    const rfNode = mountElement(
      '<div class="react-flow__node" role="button" tabindex="0"></div>'
    )
    press(rfNode, "Backspace")
    expect(diagram.getState().nodes.map((n) => n.id)).toEqual(["B"])
  })

  it("arrows nudge 10 px, Shift+arrows 50 px, but not from a focused listbox", () => {
    const { diagram } = setup(<Shortcuts />, [classNode("A", 100, 100, true)])
    const pos = () => diagram.getState().nodes[0].position

    press(document.body, "ArrowRight")
    expect(pos()).toEqual({ x: 110, y: 100 })
    press(document.body, "ArrowDown", { shiftKey: true })
    expect(pos()).toEqual({ x: 110, y: 150 })

    const listbox = mountElement('<ul role="listbox" tabindex="0"></ul>')
    press(listbox, "ArrowLeft")
    expect(pos()).toEqual({ x: 110, y: 150 })
  })

  it("an arrow nudge on a focused node stops React Flow from moving it again", () => {
    setup(<Shortcuts />, [classNode("A", 100, 100, true)])
    const rfNode = mountElement(
      '<div class="react-flow__node" role="button" tabindex="0"></div>'
    )
    const bubbled = vi.fn()
    rfNode.addEventListener("keydown", bubbled)
    press(rfNode, "ArrowUp")
    expect(bubbled).not.toHaveBeenCalled()
  })

  it("Ctrl+Z undoes; Ctrl+Shift+Z and Ctrl+Y redo (case-insensitive)", () => {
    const { diagram } = setup(<Shortcuts />)
    const undo = vi.fn()
    const redo = vi.fn()
    act(() => diagram.setState({ undo, redo }))

    press(document.body, "z", { ctrlKey: true })
    press(document.body, "Z", { ctrlKey: true, shiftKey: true })
    press(document.body, "y", { ctrlKey: true })
    press(document.body, "Y", { metaKey: true, shiftKey: true })

    expect(undo).toHaveBeenCalledTimes(1)
    expect(redo).toHaveBeenCalledTimes(3)
  })

  it("Escape clears the selection, except inside a popover or the properties panel", () => {
    const { diagram } = setup(<Shortcuts />, [classNode("A", 0, 0, true)])

    const inPopover = mountElement("<button>ok</button>", "MuiPopover-root")
    press(inPopover, "Escape")
    expect(diagram.getState().selectedElementIds).toEqual(["A"])

    press(document.body, "Escape")
    expect(diagram.getState().selectedElementIds).toEqual([])
    expect(diagram.getState().nodes[0].selected).toBe(false)
  })

  it("Enter on the canvas opens the single selected element's properties", () => {
    const { popover } = setup(<Shortcuts />, [classNode("A", 0, 0, true)])

    const button = mountElement("<button>toolbar</button>")
    press(button, "Enter")
    expect(popover.getState().popoverElementId).toBeNull()

    press(document.body, "Enter")
    expect(popover.getState().popoverElementId).toBe("A")
  })

  it("shortcuts stay out of text entry", () => {
    const { diagram } = setup(<Shortcuts />, [classNode("A", 0, 0, true)])
    const select = mountElement("<select><option>a</option></select>")
    press(select, "Backspace")
    press(select, "Escape")
    expect(diagram.getState().nodes.map((n) => n.id)).toEqual(["A"])
    expect(diagram.getState().selectedElementIds).toEqual(["A"])
  })
})

describe("getClickInsertPosition", () => {
  const view = { x: 0, y: 0, width: 800, height: 600 }
  const size = { width: 160, height: 100 }

  it("centres on the visible canvas, snapped to 10 px", () => {
    expect(getClickInsertPosition(view, size, [])).toEqual({ x: 320, y: 250 })
  })

  it("cascades down-right past existing root elements", () => {
    const first = getClickInsertPosition(view, size, [])
    const second = getClickInsertPosition(view, size, [
      classNode("A", first.x, first.y),
    ])
    expect(second.x).toBeGreaterThan(first.x)
    expect(second.y).toBeGreaterThan(first.y)
    expect(second.x - first.x).toBe(second.y - first.y)
    expect((second.x - first.x) % 20).toBe(0)
  })

  it("ignores children (only root elements block a spot)", () => {
    const child = { ...classNode("C", 320, 250), parentId: "P" }
    expect(getClickInsertPosition(view, size, [child])).toEqual({ x: 320, y: 250 })
  })

  it("falls back to the centre when the cascade would leave the view", () => {
    const blocker = classNode("A", 0, 0)
    blocker.width = 800
    blocker.height = 600
    blocker.measured = { width: 800, height: 600 }
    expect(getClickInsertPosition(view, size, [blocker])).toEqual({ x: 320, y: 250 })
  })
})

describe("palette click / keyboard insert", () => {
  const classConfig = dropElementConfigs[UMLDiagramType.ClassDiagram].find(
    (c) => c.type === "class"
  )!

  const mountPalette = (nodes: Node[] = []) => {
    const ctx = setup(
      <DraggableGhost dropElementConfig={classConfig}>
        <div>preview</div>
      </DraggableGhost>,
      nodes
    )
    // The canvas sits right of the palette (as in the real layout).
    const canvas = document.createElement("div")
    canvas.id = `react-flow-library-${ctx.diagram.getState().diagramId}`
    canvas.getBoundingClientRect = () =>
      ({ left: 200, top: 0, right: 1000, bottom: 600, width: 800, height: 600 }) as DOMRect
    document.body.appendChild(canvas)
    return { ...ctx, item: screen.getByRole("button") }
  }

  const click = (el: HTMLElement) => {
    fireEvent.pointerDown(el, { clientX: 20, clientY: 20 })
    fireEvent.pointerUp(document, { clientX: 20, clientY: 20 })
    fireEvent.click(el, { clientX: 20, clientY: 20, detail: 1 })
  }

  it("a click inserts on the canvas and selects only the new element", () => {
    const { diagram, item } = mountPalette([classNode("A", 0, 0, true)])
    click(item)

    const { nodes, selectedElementIds } = diagram.getState()
    expect(nodes).toHaveLength(2)
    const created = nodes[1]
    expect(created.type).toBe("class")
    expect(created.parentId).toBeUndefined()
    expect(created.selected).toBe(true)
    expect(nodes[0].selected).toBe(false)
    expect(selectedElementIds).toEqual([created.id])
  })

  it("repeated clicks cascade instead of stacking", () => {
    const { diagram, item } = mountPalette()
    click(item)
    click(item)
    const [a, b] = diagram.getState().nodes
    expect(b.position).not.toEqual(a.position)
    expect(b.position.x - a.position.x).toBe(b.position.y - a.position.y)
    expect(b.position.x).toBeGreaterThan(a.position.x)
  })

  it("drops palette focus after a click", () => {
    const { item } = mountPalette()
    item.focus()
    expect(document.activeElement).toBe(item)
    click(item)
    expect(document.activeElement).not.toBe(item)
  })

  it("Enter and Space insert from the keyboard; a keyboard click is not doubled", () => {
    const { diagram, item } = mountPalette()
    fireEvent.keyDown(item, { key: "Enter" })
    fireEvent.click(item, { detail: 0 })
    fireEvent.keyDown(item, { key: " " })
    expect(diagram.getState().nodes).toHaveLength(2)
  })

  it("a press that travels (a drag) is not a click insert", () => {
    const { diagram, item } = mountPalette()
    fireEvent.pointerDown(item, { clientX: 20, clientY: 20 })
    fireEvent.click(item, { clientX: 60, clientY: 20, detail: 1 })
    expect(diagram.getState().nodes).toHaveLength(0)
  })

  it("a node moving on the canvas does not re-render palette items", () => {
    const onRender = vi.fn()
    const { diagram } = setup(
      <Profiler id="palette" onRender={onRender}>
        <DraggableGhost dropElementConfig={classConfig}>
          <div>preview</div>
        </DraggableGhost>
      </Profiler>,
      [classNode("A", 0, 0)]
    )
    onRender.mockClear()
    act(() =>
      diagram.getState().onNodesChange([
        { id: "A", type: "position", position: { x: 40, y: 0 }, dragging: true },
      ])
    )
    expect(onRender).not.toHaveBeenCalled()
  })

  it("palette items are named, focusable buttons", () => {
    const { item } = mountPalette()
    expect(item.getAttribute("tabindex")).toBe("0")
    expect(item.getAttribute("aria-label")).toBeTruthy()
  })
})

describe("colour swatches", () => {
  it("have accessible names and mark the current colour pressed", () => {
    setup(<ColorButtons onSelect={() => {}} selectedColor="#FC5C65" />)
    const red = screen.getByRole("button", { name: "Red" })
    expect(red.getAttribute("aria-pressed")).toBe("true")
    expect(red.className).toContain("besser-color-swatch")
    expect(
      screen.getByRole("button", { name: "Sky blue" }).getAttribute("aria-pressed")
    ).toBe("false")
    expect(screen.getAllByRole("button")).toHaveLength(12)
  })
})
