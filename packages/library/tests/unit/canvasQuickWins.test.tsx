import { useEffect, useRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, useStoreApi, type Node } from "@xyflow/react"
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
import { CustomControls } from "@/components/CustomControls"
import { ClassOCLConstraintSVG } from "@/components/svgs/nodes/classDiagram"
import { CommentConfig, dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"

/**
 * Canvas quick wins found in the React Flow UX review (2026-10-06):
 * one undo step per gesture, keyboard zoom, palette drop selects and the
 * ghost previews the canvas size, click-insert avoids stacking, the
 * controls CSS variable survives an editor swap, theme-aware sticky
 * previews.
 */

const zoomSpies = vi.hoisted(() => ({
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  zoomTo: vi.fn(),
  fitView: vi.fn(),
}))

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>()
  return {
    ...actual,
    useReactFlow: () => ({ ...actual.useReactFlow(), ...zoomSpies }),
  }
})

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

const setup = (
  ui: React.ReactElement,
  nodes: Node[] = [],
  withUndo = false
) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  act(() => {
    diagram.getState().setNodes(nodes)
    diagram
      .getState()
      .setSelectedElementsId(nodes.filter((n) => n.selected).map((n) => n.id))
    if (withUndo) diagram.getState().initializeUndoManager()
  })
  const utils = render(
    <DiagramStoreContext.Provider value={diagram as StoreApi<DiagramStore>}>
      <MetadataStoreContext.Provider value={metadata}>
        <PopoverStoreContext.Provider value={createPopoverStore()}>
          <AssessmentSelectionStoreContext.Provider
            value={createAssessmentSelectionStore()}
          >
            <ReactFlowProvider>{ui}</ReactFlowProvider>
          </AssessmentSelectionStoreContext.Provider>
        </PopoverStoreContext.Provider>
      </MetadataStoreContext.Provider>
    </DiagramStoreContext.Provider>
  )
  return { diagram, ...utils }
}

const Shortcuts = () => {
  useKeyboardShortcuts()
  return null
}

const press = (
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {}
) => {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

const pointerDown = (target: EventTarget = document.body) =>
  act(() => {
    target.dispatchEvent(new Event("pointerdown", { bubbles: true }))
  })

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
  vi.clearAllMocks()
})

describe("undo granularity: one step per user gesture", () => {
  // All writes below land well inside the UndoManager's 500 ms
  // captureTimeout, which used to merge them into a single step.
  it("two quick inserts are two undo steps", () => {
    const { diagram } = setup(<Shortcuts />, [], true)
    const insert = (id: string) =>
      act(() =>
        diagram.getState().setNodes((nodes) => [...nodes, classNode(id, 0, 0)])
      )

    pointerDown()
    insert("A")
    pointerDown()
    insert("B")

    expect(diagram.getState().undoManager!.undoStack).toHaveLength(2)
    act(() => {
      diagram.getState().undo()
      diagram.getState().updateNodesFromYjs()
    })
    expect(diagram.getState().nodes.map((n) => n.id)).toEqual(["A"])
  })

  it("each arrow nudge is a step, a held key (auto-repeat) is one burst", () => {
    const { diagram } = setup(<Shortcuts />, [classNode("A", 0, 0, true)], true)
    const undoManager = diagram.getState().undoManager!

    press(document.body, "ArrowRight")
    press(document.body, "ArrowRight")
    expect(undoManager.undoStack).toHaveLength(2)

    press(document.body, "ArrowDown")
    press(document.body, "ArrowDown", { repeat: true })
    press(document.body, "ArrowDown", { repeat: true })
    expect(undoManager.undoStack).toHaveLength(3)
    expect(diagram.getState().nodes[0].position).toEqual({ x: 20, y: 30 })

    act(() => {
      diagram.getState().undo()
      diagram.getState().updateNodesFromYjs()
    })
    expect(diagram.getState().nodes[0].position).toEqual({ x: 20, y: 0 })
  })

  it("continuous typing in a field still merges into one step", () => {
    const { diagram } = setup(<Shortcuts />, [classNode("A", 0, 0)], true)
    const input = document.createElement("input")
    document.body.appendChild(input)
    pointerDown(input)
    for (const name of ["B", "Bo", "Boo", "Book"]) {
      press(input, name.slice(-1))
      act(() =>
        diagram
          .getState()
          .setNodes((nodes) => nodes.map((n) => ({ ...n, data: { ...n.data, name } })))
      )
    }
    expect(diagram.getState().undoManager!.undoStack).toHaveLength(1)
  })
})

describe("keyboard zoom", () => {
  it("Ctrl/Cmd + = / - / 0 zoom the canvas and suppress browser zoom", () => {
    setup(<Shortcuts />)
    expect(press(document.body, "=", { ctrlKey: true, code: "Equal" }).defaultPrevented).toBe(true)
    press(document.body, "-", { metaKey: true, code: "Minus" })
    press(document.body, "0", { ctrlKey: true, code: "Digit0" })
    expect(zoomSpies.zoomIn).toHaveBeenCalledTimes(1)
    expect(zoomSpies.zoomOut).toHaveBeenCalledTimes(1)
    expect(zoomSpies.zoomTo).toHaveBeenCalledWith(1)
  })

  it("Shift+1 fits the view, Shift+2 zooms to the selection", () => {
    setup(<Shortcuts />, [classNode("A", 0, 0, true), classNode("B", 400, 0)])
    press(document.body, "!", { shiftKey: true, code: "Digit1" })
    expect(zoomSpies.fitView).toHaveBeenCalledTimes(1)
    expect(zoomSpies.fitView.mock.calls[0][0].nodes).toBeUndefined()

    press(document.body, "@", { shiftKey: true, code: "Digit2" })
    expect(zoomSpies.fitView).toHaveBeenCalledTimes(2)
    expect(zoomSpies.fitView.mock.calls[1][0].nodes).toEqual([{ id: "A" }])
  })

  it("does not fire while typing or on a focused control (browser zoom stays)", () => {
    setup(<Shortcuts />, [classNode("A", 0, 0, true)])
    const input = document.createElement("input")
    const button = document.createElement("button")
    document.body.append(input, button)
    const typed = press(input, "=", { ctrlKey: true, code: "Equal" })
    press(button, "-", { ctrlKey: true, code: "Minus" })
    press(input, "@", { shiftKey: true, code: "Digit2" })
    expect(typed.defaultPrevented).toBe(false)
    expect(zoomSpies.zoomIn).not.toHaveBeenCalled()
    expect(zoomSpies.zoomOut).not.toHaveBeenCalled()
    expect(zoomSpies.fitView).not.toHaveBeenCalled()
  })
})

describe("palette drag and click insert", () => {
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
    const canvas = document.createElement("div")
    canvas.id = `react-flow-library-${ctx.diagram.getState().diagramId}`
    canvas.getBoundingClientRect = () =>
      ({ left: 200, top: 0, right: 1000, bottom: 600, width: 800, height: 600 }) as DOMRect
    document.body.appendChild(canvas)
    return { ...ctx, item: screen.getByRole("button", { name: "Class" }) }
  }

  const pointer = (type: string, target: EventTarget, x: number, y: number) =>
    act(() => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
      target.dispatchEvent(event)
    })

  it("a class dropped from the palette becomes the only selection", () => {
    const { diagram, item } = mountPalette([classNode("A", 0, 0, true)])
    pointer("pointerdown", item, 10, 10)
    pointer("pointermove", document, 500, 300)
    pointer("pointerup", document, 500, 300)

    const { nodes, selectedElementIds } = diagram.getState()
    const dropped = nodes.find((n) => n.id !== "A")!
    expect(dropped.selected).toBe(true)
    expect(nodes.find((n) => n.id === "A")!.selected).toBe(false)
    expect(selectedElementIds).toEqual([dropped.id])
  })

  it("the drag ghost is drawn at the canvas zoom, not the palette's 0.8", () => {
    const { item } = mountPalette()
    pointer("pointerdown", item, 10, 10)
    const ghost = screen.getAllByText("preview")[1].parentElement!
    // Canvas zoom 1 / SIDEBAR_PREVIEW_SCALE 0.8.
    expect(ghost.style.transform).toBe("scale(1.25)")
    expect(ghost.style.transformOrigin).toBe("0 0")
    pointer("pointerup", document, 0, 0)
  })

  it("click insert finds a free spot instead of stacking when the cascade runs out", () => {
    const view = { x: 0, y: 0, width: 800, height: 600 }
    const size = { width: 160, height: 100 }
    // Covers the centre and everything down-right of it: every cascade
    // step is blocked, while the top-left of the view is empty.
    const blocker = classNode("A", 300, 230)
    blocker.width = 500
    blocker.height = 370
    blocker.measured = { width: 500, height: 370 }

    const spot = getClickInsertPosition(view, size, [blocker])
    const overlaps =
      spot.x < 300 + 500 && 300 < spot.x + size.width &&
      spot.y < 230 + 370 && 230 < spot.y + size.height
    expect(overlaps).toBe(false)
    expect(spot.x).toBeGreaterThanOrEqual(0)
    expect(spot.y).toBeGreaterThanOrEqual(0)
    expect(spot.x + size.width).toBeLessThanOrEqual(800)
    expect(spot.y + size.height).toBeLessThanOrEqual(600)
    // Nearest free spot to the centre, not just any free spot.
    expect(Math.hypot(spot.x - 320, spot.y - 250)).toBeLessThan(250)
  })
})

describe("canvas controls CSS variable", () => {
  const VAR = "--besser-canvas-controls-right"

  // CustomControls only publishes once React Flow has a DOM node.
  const Host = () => {
    const ref = useRef<HTMLDivElement>(null)
    const api = useStoreApi()
    useEffect(() => {
      api.setState({ domNode: ref.current })
    }, [api])
    return (
      <div ref={ref}>
        <CustomControls />
      </div>
    )
  }
  const mountControls = () => setup(<Host />)

  it("a replaced editor's cleanup keeps the value the new editor published", () => {
    const first = mountControls()
    expect(document.documentElement.style.getPropertyValue(VAR)).not.toBe("")
    const second = mountControls()
    first.unmount()
    expect(document.documentElement.style.getPropertyValue(VAR)).not.toBe("")
    second.unmount()
    expect(document.documentElement.style.getPropertyValue(VAR)).toBe("")
  })
})

describe("palette sticky-note previews follow the theme", () => {
  it("the OCL constraint and comment previews use the sticky theme variables", () => {
    const { container } = render(
      <>
        <ClassOCLConstraintSVG width={160} height={70} data={{ name: "c", expression: "" } as never} />
        <CommentConfig.svg width={160} height={60} data={{ name: "Comment" }} />
      </>
    )
    const paths = [...container.querySelectorAll("svg > path:first-of-type")]
    expect(paths).toHaveLength(2)
    for (const path of paths) {
      expect(path.getAttribute("fill")).toBe("var(--besser-sticky-fill, #fff8c4)")
      expect(path.getAttribute("stroke")).toBe("var(--besser-sticky-stroke, #bda21f)")
    }
    for (const text of container.querySelectorAll("text")) {
      expect(text.getAttribute("fill")).toBe("var(--besser-sticky-text, #3a2e00)")
    }
  })
})
