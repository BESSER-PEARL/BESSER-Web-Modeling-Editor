/**
 * Inspector / canvas parity with develop (old Apollon editor):
 *  - panels survive their node being deleted (hooks declared before the
 *    early return);
 *  - Comment / UserModelName panels show ONE name field;
 *  - method implementation pickers show develop's "no … available" hint;
 *  - Enter in an attribute / method row moves to the next row
 *    (develop `onSubmitKeyUp`);
 *  - OCL / association-class links get develop's plain relationship
 *    editor (no name / type / ends);
 *  - Abstract / Enumeration stereotype buttons are translated;
 *  - adding / deleting a pool lane keeps children where they were;
 *  - BPMN task names with a type icon wrap instead of truncating;
 *  - NN cards use the theme fill (readable in dark mode).
 */
import { describe, it, expect, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import { ReactFlowProvider, type Edge, type Node } from "@xyflow/react"
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
import { Locale } from "@/typings"
import { ClassEditPanel } from "@/components/inspectors/classDiagram/ClassEditPanel"
import { ClassEdgeEditPanel } from "@/components/inspectors/classDiagram/ClassEdgeEditPanel"
import { ObjectEditPanel } from "@/components/inspectors/objectDiagram/ObjectEditPanel"
import { CommentEditPanel } from "@/components/inspectors/common/CommentEditPanel"
import { UserModelNameEditPanel } from "@/components/inspectors/userDiagram/UserModelNameEditPanel"
import { BPMNPoolEditPopover } from "@/components/popovers/bpmnDiagram/BPMNPoolEditPopover"
import { BPMNTaskNodeSVG } from "@/components/svgs/nodes/bpmnDiagram/BPMNTaskNodeSVG"
import { NNReference } from "@/nodes/nnDiagram/NNReference"
import { NNContainer } from "@/nodes/nnDiagram/NNContainer"
import { TensorOp } from "@/nodes/nnDiagram/TensorOp"
import { POOL_HEADER_WIDTH } from "@/hooks/useSwimlaneLayout"

vi.mock("@uiw/react-codemirror", async () => {
  const ReactModule = await import("react")
  return {
    default: (props: { value?: string }) =>
      ReactModule.createElement("textarea", {
        "data-testid": "codemirror",
        value: props.value ?? "",
        readOnly: true,
      }),
  }
})
vi.mock("@codemirror/lang-python", () => ({ python: () => [] }))

const renderWith = (
  ui: React.ReactElement,
  nodes: Node[] = [],
  edges: Edge[] = [],
  locale: Locale = Locale.en
) => {
  const ydoc = new Y.Doc()
  const metadata = createMetadataStore(ydoc)
  const diagram = createDiagramStore(ydoc)
  metadata.getState().setLocale(locale)
  diagram.getState().setNodesAndEdges(nodes, edges)
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

const classNode = (data: Record<string, unknown> = {}): Node => ({
  id: "class-1",
  type: "class",
  position: { x: 0, y: 0 },
  width: 200,
  height: 110,
  data: { name: "Person", attributes: [], methods: [], ...data },
})

describe("panels survive their node being deleted", () => {
  it("ClassEditPanel", () => {
    const { diagram, container } = renderWith(
      <ClassEditPanel elementId="class-1" />,
      [classNode()]
    )
    act(() => diagram.getState().setNodes([]))
    expect(container.innerHTML).toBe("")
  })

  it("ObjectEditPanel", () => {
    const { diagram, container } = renderWith(
      <ObjectEditPanel elementId="obj-1" />,
      [
        {
          id: "obj-1",
          type: "objectName",
          position: { x: 0, y: 0 },
          width: 200,
          height: 100,
          data: { name: "rex", attributes: [] },
        },
      ]
    )
    act(() => diagram.getState().setNodes([]))
    expect(container.innerHTML).toBe("")
  })
})

describe("single name field", () => {
  const inputsWithValue = (value: string) =>
    Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input, textarea"
      )
    ).filter((el) => el.value === value)

  it("CommentEditPanel shows the comment text once", () => {
    renderWith(<CommentEditPanel elementId="c" />, [
      {
        id: "c",
        type: "comment",
        position: { x: 0, y: 0 },
        width: 160,
        height: 80,
        data: { name: "remember the index" },
      },
    ])
    expect(inputsWithValue("remember the index")).toHaveLength(1)
  })

  it("UserModelNameEditPanel shows the name once", () => {
    renderWith(<UserModelNameEditPanel elementId="u" />, [
      {
        id: "u",
        type: "UserModelName",
        position: { x: 0, y: 0 },
        width: 160,
        height: 100,
        data: { name: "user_1", attributes: [] },
      },
    ])
    expect(inputsWithValue("user_1")).toHaveLength(1)
  })
})

describe("method implementation pickers", () => {
  it("shows 'No state machines available' when the project has none", () => {
    renderWith(<ClassEditPanel elementId="class-1" />, [
      classNode({
        methods: [
          {
            id: "m1",
            name: "run",
            visibility: "public",
            attributeType: "any",
            implementationType: "state_machine",
          },
        ],
      }),
    ])
    expect(screen.getByText("No state machines available")).toBeInTheDocument()
  })

  it("shows 'No quantum circuits available' when the project has none", () => {
    renderWith(<ClassEditPanel elementId="class-1" />, [
      classNode({
        methods: [
          {
            id: "m1",
            name: "run",
            visibility: "public",
            attributeType: "any",
            implementationType: "quantum_circuit",
          },
        ],
      }),
    ])
    expect(screen.getByText("No quantum circuits available")).toBeInTheDocument()
  })
})

describe("Enter moves to the next row (develop onSubmitKeyUp)", () => {
  const attrs = [
    { id: "a1", name: "first", visibility: "public", attributeType: "str" },
    { id: "a2", name: "second", visibility: "public", attributeType: "str" },
  ]

  it("attribute row -> next attribute row -> new-attribute input", () => {
    renderWith(<ClassEditPanel elementId="class-1" />, [
      classNode({ attributes: attrs }),
    ])
    const first = screen.getByDisplayValue("first")
    const second = screen.getByDisplayValue("second")
    first.focus()
    fireEvent.keyDown(first, { key: "Enter" })
    expect(document.activeElement).toBe(second)
    fireEvent.keyDown(second, { key: "Enter" })
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("+ Add attribute (Enter for auto-name)")
    )
  })

  it("last method row -> new-method input", () => {
    renderWith(<ClassEditPanel elementId="class-1" />, [
      classNode({
        methods: [
          { id: "m1", name: "run", visibility: "public", attributeType: "any" },
        ],
      }),
    ])
    const row = screen.getByDisplayValue("run")
    row.focus()
    fireEvent.keyDown(row, { key: "Enter" })
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("+ Add method (Enter)")
    )
  })
})

describe("ClassEdgeEditPanel — OCL / association-class links", () => {
  const nodes = [classNode(), { ...classNode(), id: "class-2" }]
  const edge = (type: string): Edge => ({
    id: "e",
    type,
    source: "class-1",
    target: "class-2",
    data: { name: "" },
  })

  it.each(["ClassOCLLink", "ClassLinkRel"])(
    "%s shows only the colour editor (develop DefaultRelationshipPopup)",
    (type) => {
      renderWith(<ClassEdgeEditPanel elementId="e" />, nodes, [edge(type)])
      expect(screen.queryByLabelText("Association name")).toBeNull()
      expect(screen.queryByText("Multiplicity")).toBeNull()
      expect(screen.queryByText("Role")).toBeNull()
      expect(screen.getByText("Relationship")).toBeInTheDocument()
    }
  )

  it("a plain association still shows name and ends", () => {
    renderWith(<ClassEdgeEditPanel elementId="e" />, nodes, [
      edge("ClassBidirectional"),
    ])
    expect(screen.getByLabelText("Association name")).toBeInTheDocument()
    expect(screen.getAllByText("Multiplicity")).toHaveLength(2)
  })
})

describe("stereotype buttons are translated", () => {
  it("renders the develop labels in German", () => {
    renderWith(<ClassEditPanel elementId="class-1" />, [classNode()], [], Locale.de)
    expect(screen.getByText("Abstrakt")).toBeInTheDocument()
    expect(screen.getByText("Aufzählung")).toBeInTheDocument()
  })
})

describe("pool lanes keep children in place", () => {
  const pool: Node = {
    id: "pool",
    type: "bpmnPool",
    position: { x: 0, y: 0 },
    width: 600,
    height: 200,
    data: { name: "Pool" },
  }
  const task: Node = {
    id: "task",
    type: "bpmnTask",
    parentId: "pool",
    position: { x: 100, y: 50 },
    width: 160,
    height: 60,
    data: { name: "Task" },
  }

  it("adding the first lane shifts the reparented child by the lane offset", () => {
    const { diagram } = renderWith(
      <BPMNPoolEditPopover elementId="pool" />,
      [pool, task]
    )
    fireEvent.click(screen.getByText("Add Lane"))
    const nodes = diagram.getState().nodes
    const lane = nodes.find((n) => n.type === "bpmnSwimlane")!
    const moved = nodes.find((n) => n.id === "task")!
    expect(moved.parentId).toBe(lane.id)
    expect(lane.position.x).toBe(POOL_HEADER_WIDTH)
    // Same pool-relative (hence on-screen) position as before.
    expect(lane.position.x + moved.position.x).toBe(100)
    expect(lane.position.y + moved.position.y).toBe(50)
  })

  it("deleting a lane shifts its children back by the lane offset", () => {
    const lane: Node = {
      id: "lane",
      type: "bpmnSwimlane",
      parentId: "pool",
      position: { x: POOL_HEADER_WIDTH, y: 80 },
      width: 560,
      height: 120,
      data: { name: "Lane" },
    }
    const laneTask = { ...task, parentId: "lane", position: { x: 60, y: 20 } }
    const { diagram } = renderWith(<BPMNPoolEditPopover elementId="pool" />, [
      pool,
      lane,
      laneTask,
    ])
    fireEvent.click(screen.getByLabelText("Delete lane"))
    const moved = diagram.getState().nodes.find((n) => n.id === "task")!
    expect(moved.parentId).toBe("pool")
    expect(moved.position).toEqual({ x: POOL_HEADER_WIDTH + 60, y: 100 })
  })
})

describe("BPMN task name wraps when a type icon is shown", () => {
  it("a 160x60 user task renders more than one name line", () => {
    const { container } = renderWith(
      <BPMNTaskNodeSVG
        id="t"
        width={160}
        height={60}
        data={{
          name: "Review application form",
          taskType: "user",
          marker: "none",
        } as never}
      />
    )
    const nameText = Array.from(container.querySelectorAll("text")).find((t) =>
      (t.textContent ?? "").includes("Review")
    )!
    const lines = nameText.querySelectorAll("tspan")
    expect(lines.length).toBeGreaterThan(1)
    expect(nameText.textContent).not.toContain("…")
  })
})

describe("NN cards use the theme fill", () => {
  const nodeProps = (id: string, data: Record<string, unknown>, w = 200, h = 160) =>
    ({ id, width: w, height: h, data, type: "x" }) as never

  it("NNReference", () => {
    const { container } = renderWith(
      <NNReference {...nodeProps("r", { name: "ref" }, 120, 40)} />,
      [{ id: "r", type: "NNReference", position: { x: 0, y: 0 }, data: { name: "ref" } }]
    )
    const card = container.querySelector("rect[stroke-dasharray]")!
    expect(card.getAttribute("fill")).toBe("var(--besser-background)")
  })

  it("NNContainer", () => {
    const { container } = renderWith(
      <NNContainer {...nodeProps("c", { name: "Net" })} />,
      [{ id: "c", type: "NNContainer", position: { x: 0, y: 0 }, data: { name: "Net" } }]
    )
    const fills = Array.from(container.querySelectorAll("rect")).map((r) =>
      r.getAttribute("fill")
    )
    expect(fills).not.toContain("#FFFFFF")
    expect(fills).toContain("var(--besser-background)")
  })

  it("layer cards keep their kind colour with text readable in dark mode", () => {
    // 50px high: too small for the icon, so the plain card rect is drawn.
    const { container } = renderWith(
      <TensorOp {...nodeProps("op", { name: "op", attributes: {} }, 160, 50)} />,
      [{ id: "op", type: "TensorOp", position: { x: 0, y: 0 }, data: { name: "op" } }]
    )
    const fills = Array.from(container.querySelectorAll("rect")).map((r) =>
      r.getAttribute("fill")
    )
    expect(fills).toContain("#FFF3E0")
    const textFills = Array.from(container.querySelectorAll("text")).map((el) =>
      el.getAttribute("fill")
    )
    // A theme text colour (white in dark mode) on a light pastel was unreadable.
    expect(textFills.length).toBeGreaterThan(0)
    expect(textFills.every((f) => f === "#1f2937")).toBe(true)
  })
})
