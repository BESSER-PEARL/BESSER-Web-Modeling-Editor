/**
 * Regressions found comparing the React Flow engine with develop on
 * imported v3 class / object / user diagrams (fix wave 2). Each block
 * names the live symptom it pins.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Edge, Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { Tooltip } from "@mui/material"
import {
  AssessmentSelectionStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { ReactFlowProvider } from "@xyflow/react"
import { createAssessmentSelectionStore } from "@/store/assessmentSelectionStore"
import { createMetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { useSettingsStore } from "@/store/settingsStore"
import { ClassEditPanel } from "@/components/inspectors/classDiagram/ClassEditPanel"
import { ClassEdgeEditPanel } from "@/components/inspectors/classDiagram/ClassEdgeEditPanel"
import { ObjectEditPanel } from "@/components/inspectors/objectDiagram/ObjectEditPanel"
import { StereotypeButtonGroup } from "@/components/ui/StereotypeButtonGroup"
import { Typography } from "@/components/ui"
import { ClassNodeElement, ClassNodeProps, ClassType, ObjectNodeProps } from "@/types"
import { importDiagram } from "@/utils/versionConverter"
import {
  formatDisplayName,
  formatObjectMember,
} from "@/utils/classifierMemberDisplay"
import { diagramBridge } from "@/services/diagramBridge"
import { UserModelName } from "@/nodes/userDiagram/UserModelName"

vi.mock("@uiw/react-codemirror", async () => {
  const ReactModule = await import("react")
  return {
    default: (props: { value?: string; onChange?: (v: string) => void }) =>
      ReactModule.createElement("textarea", {
        "data-testid": "codemirror",
        value: props.value ?? "",
        onChange: (e: { target: { value: string } }) =>
          props.onChange?.(e.target.value),
      }),
  }
})
vi.mock("@codemirror/lang-python", () => ({ python: () => [] }))

const bounds = { x: 0, y: 0, width: 200, height: 30 }

/** A v3 class diagram with `children` owned by class `c1`. */
const v3ClassModel = (children: Record<string, unknown>[]) => ({
  version: "3.0.0",
  type: "ClassDiagram",
  size: { width: 0, height: 0 },
  interactive: { elements: {}, relationships: {} },
  assessments: {},
  relationships: {},
  elements: {
    c1: {
      id: "c1",
      name: "Person",
      type: "Class",
      owner: null,
      bounds: { x: 0, y: 0, width: 200, height: 200 },
      attributes: children
        .filter((c) => c.type === "ClassAttribute")
        .map((c) => c.id),
      methods: children.filter((c) => c.type === "ClassMethod").map((c) => c.id),
    },
    ...Object.fromEntries(
      children.map((c) => [c.id, { owner: "c1", bounds, ...c }])
    ),
  },
})

const methodsOf = (model: ReturnType<typeof importDiagram>) =>
  (model.nodes.find((n) => n.id === "c1")!.data as ClassNodeProps).methods

const methodText = (row: ClassNodeElement) =>
  formatDisplayName(row, "UML", undefined, true)

/* -------------------------------------------------------------------------- */
/* 1. v3 method signatures                                                     */
/* -------------------------------------------------------------------------- */

describe("v3 method names carrying the whole signature", () => {
  // Live data: old-crafted2-export.json (develop export).
  const model = importDiagram(
    v3ClassModel([
      {
        id: "m-run",
        type: "ClassMethod",
        name: "+ run(): any",
        visibility: "public",
        attributeType: "str",
      },
      {
        id: "m-total",
        type: "ClassMethod",
        name: "- total(): float",
        visibility: "private",
        attributeType: "float",
      },
      {
        id: "m-notify",
        type: "ClassMethod",
        name: "# notify(self, sms: str = 'a, b', n: int = 3): bool",
        visibility: "public",
        attributeType: "str",
      },
      {
        // Template junk in attributeType; develop rendered the name only.
        id: "m-stock",
        type: "ClassMethod",
        name: "+ decrease_stock(qty: int)",
        visibility: "public",
        attributeType: "int): any",
      },
    ])
  )
  const [run, total, notify, stock] = methodsOf(model)

  it("splits visibility, name, parameters and return type", () => {
    expect(run).toMatchObject({
      name: "run",
      visibility: "public",
      returnType: "any",
      attributeType: "any",
      parameters: [],
    })
    expect(total).toMatchObject({
      name: "total",
      visibility: "private",
      returnType: "float",
    })
    expect(notify.name).toBe("notify")
    expect(notify.visibility).toBe("protected")
    expect(notify.returnType).toBe("bool")
    // As the backend's name parser read it: `self` kept, quotes stripped.
    expect(notify.parameters).toMatchObject([
      { name: "self" },
      { name: "sms", parameterType: "str", defaultValue: "a, b" },
      { name: "n", parameterType: "int", defaultValue: "3" },
    ])
    expect(stock).toMatchObject({ name: "decrease_stock", returnType: "" })
  })

  it("keeps the canvas text develop rendered", () => {
    expect(methodText(run)).toBe("+ run(): any")
    expect(methodText(total)).toBe("- total(): float")
    expect(methodText(notify)).toBe("# notify(self, sms: str = a, b, n: int = 3): bool")
    expect(methodText(stock)).toBe("+ decrease_stock(qty: int)")
  })

  it("normalises v4 nodes that still hold a fused signature (idempotent)", () => {
    const v4 = {
      version: "4.0.0",
      id: "d",
      title: "",
      type: "ClassDiagram",
      nodes: [
        {
          id: "c1",
          type: "class",
          position: { x: 0, y: 0 },
          width: 200,
          height: 100,
          data: {
            name: "Person",
            attributes: [],
            methods: [
              {
                id: "m1",
                name: "+ greet(name: str): str",
                visibility: "public",
                attributeType: "str",
                parameters: [{ id: "p-keep", name: "name", parameterType: "str" }],
              },
            ],
          },
        },
      ],
      edges: [],
      assessments: {},
    }
    const once = importDiagram(v4)
    const [m] = methodsOf(once)
    expect(m).toMatchObject({ name: "greet", returnType: "str" })
    // Existing parameter ids survive the split.
    expect(m.parameters?.[0].id).toBe("p-keep")
    expect(importDiagram(once)).toEqual(once)
  })

  it("editing the return type in the inspector changes the canvas text", () => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes(model.nodes as Node[])
    render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <ClassEditPanel elementId="c1" />
      </DiagramStoreContext.Provider>
    )
    // The name field shows the bare name, not "+ run(): any".
    const names = screen.getAllByLabelText("Method name") as HTMLInputElement[]
    expect(names[0].value).toBe("run")

    fireEvent.mouseDown(screen.getAllByLabelText("Return type")[0])
    fireEvent.click(screen.getByRole("option", { name: /^int/ }))
    const row = (store.getState().nodes[0].data as ClassNodeProps).methods[0]
    expect(methodText(row)).toBe("+ run(): int")
  }, 20000)
})

/* -------------------------------------------------------------------------- */
/* 2. Legacy v3 member rows                                                    */
/* -------------------------------------------------------------------------- */

describe("legacy v3 member rows (no `visibility`)", () => {
  it("object attributes keep their stored type", () => {
    const model = importDiagram({
      version: "3.0.0",
      type: "ObjectDiagram",
      size: { width: 0, height: 0 },
      interactive: { elements: {}, relationships: {} },
      assessments: {},
      relationships: {},
      elements: {
        o1: {
          id: "o1",
          name: "cart",
          type: "ObjectName",
          owner: null,
          bounds: { x: 0, y: 0, width: 200, height: 80 },
          attributes: ["a1"],
          methods: [],
        },
        a1: {
          id: "a1",
          name: "total = 9.5",
          type: "ObjectAttribute",
          owner: "o1",
          bounds,
          attributeType: "float",
        },
      },
    })
    const attr = (model.nodes[0].data as ObjectNodeProps).attributes[0]
    expect(attr).toMatchObject({ name: "total", value: "9.5", attributeType: "float" })
  })

  it("keeps defaultValue and promotes code with no implementation type", () => {
    const model = importDiagram(
      v3ClassModel([
        { id: "a1", type: "ClassAttribute", name: "+ total: float", defaultValue: "0.0" },
        {
          id: "m1",
          type: "ClassMethod",
          name: "+ greet(): str",
          visibility: "public",
          attributeType: "str",
          implementationType: "none",
          code: "def greet(self):\n    return 'hi'",
        },
      ])
    )
    const data = model.nodes.find((n) => n.id === "c1")!.data as ClassNodeProps
    expect(data.attributes[0]).toMatchObject({
      name: "total",
      attributeType: "float",
      defaultValue: "0.0",
    })
    expect(data.methods[0].implementationType).toBe("code")
  })
})

/* -------------------------------------------------------------------------- */
/* 3. Object diagrams only instantiate classes                                 */
/* -------------------------------------------------------------------------- */

describe("diagramBridge.getAvailableClasses", () => {
  afterEach(() => diagramBridge.clearDiagramData())

  it("offers plain and abstract classes, not interfaces or enumerations", () => {
    const cls = (id: string, stereotype?: string) => ({
      id,
      type: "class",
      position: { x: 0, y: 0 },
      data: { name: id, attributes: [], methods: [], ...(stereotype && { stereotype }) },
    })
    diagramBridge.setClassDiagramData({
      nodes: [cls("Car"), cls("Shape", "Abstract"), cls("Drawable", "Interface"), cls("Color", "Enumeration")],
      edges: [],
    } as never)
    expect(diagramBridge.getAvailableClasses().map((c) => c.name)).toEqual([
      "Car",
      "Shape",
    ])
  })
})

/* -------------------------------------------------------------------------- */
/* 4. User-model criterion rows                                                */
/* -------------------------------------------------------------------------- */

describe("user-model rows that embed the criterion in their name", () => {
  // Live data: templates/pattern/project/personalized_gym_agent.json
  const userModel = importDiagram({
    version: "4.0.0",
    id: "u",
    title: "",
    type: "UserDiagram",
    nodes: [
      {
        id: "u1",
        type: "UserModelName",
        position: { x: 0, y: 0 },
        width: 200,
        height: 120,
        data: {
          name: "alice",
          attributes: [
            { id: "r1", name: "age < 18", attributeType: "str", attributeOperator: "<" },
            { id: "r2", name: "lastName = ", attributeType: "str", attributeOperator: "==" },
            { id: "r3", name: "name == Paraplegia", attributeType: "str" },
          ],
        },
      },
    ],
    edges: [],
    assessments: {},
  })
  const rows = (userModel.nodes[0].data as { attributes: Record<string, unknown>[] })
    .attributes

  it("splits name / operator / value on load", () => {
    expect(rows[0]).toMatchObject({ name: "age", attributeOperator: "<", value: "18" })
    expect(rows[1]).toMatchObject({ name: "lastName", attributeOperator: "==" })
    expect(rows[1].value).toBeUndefined()
    expect(rows[2]).toMatchObject({ name: "name", attributeOperator: "==", value: "Paraplegia" })
  })

  it("the canvas shows inspector edits even on an unmigrated legacy row", () => {
    const ydoc = new Y.Doc()
    const store = createDiagramStore(ydoc)
    const data = {
      name: "alice",
      view: "attributes",
      attributes: [
        { id: "r1", name: "age < 18", attributeOperator: ">=", value: "21" },
      ],
    }
    store.getState().setNodes([
      { id: "u1", type: "UserModelName", position: { x: 0, y: 0 }, data } as Node,
    ])
    const { container } = render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <MetadataStoreContext.Provider value={createMetadataStore(ydoc)}>
          <PopoverStoreContext.Provider value={createPopoverStore()}>
            <AssessmentSelectionStoreContext.Provider
              value={createAssessmentSelectionStore()}
            >
              <ReactFlowProvider>
                <UserModelName
                  {...({ id: "u1", width: 200, height: 120, data } as never)}
                />
              </ReactFlowProvider>
            </AssessmentSelectionStoreContext.Provider>
          </PopoverStoreContext.Provider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    )
    expect(container.textContent).toContain("age >= 21")
    expect(container.textContent).not.toContain("age < 18")
  })
})

/* -------------------------------------------------------------------------- */
/* 5, 10, 11. Association edge pane                                            */
/* -------------------------------------------------------------------------- */

const twoClasses = (): Node[] =>
  ["A", "B"].map((id, i) => ({
    id,
    type: "class",
    position: { x: i * 300, y: 0 },
    width: 200,
    height: 100,
    data: { name: id, attributes: [], methods: [] },
  }))

const renderEdgePanel = (edge: Edge) => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setNodes(twoClasses())
  store.getState().setEdges([edge])
  render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      <ClassEdgeEditPanel elementId={edge.id} />
    </DiagramStoreContext.Provider>
  )
  return store
}

const assoc = (data: Record<string, unknown> = {}): Edge => ({
  id: "e1",
  source: "A",
  target: "B",
  type: "ClassBidirectional",
  data: {
    sourceMultiplicity: "1",
    targetMultiplicity: "0..*",
    sourceRole: "owner",
    targetRole: "items",
    sourceNavigable: false,
    targetNavigable: true,
    points: [],
    ...data,
  },
})

describe("ClassEdgeEditPanel", () => {
  afterEach(() => useSettingsStore.setState({ showAssociationNames: false }))

  it("flip keeps each class's multiplicity, role and navigability", () => {
    const store = renderEdgePanel(assoc())
    fireEvent.click(screen.getByLabelText("Flip source / target"))
    const e = store.getState().edges[0]
    expect(e.source).toBe("B")
    expect(e.data).toMatchObject({
      sourceMultiplicity: "0..*",
      sourceRole: "items",
      sourceNavigable: true,
      targetMultiplicity: "1",
      targetRole: "owner",
      targetNavigable: false,
    })
  })

  it("says the name is hidden while association names are off", () => {
    useSettingsStore.setState({ showAssociationNames: false })
    renderEdgePanel(assoc())
    expect(screen.getByText(/Hidden on the canvas/)).toBeTruthy()
  })

  it("shows no hint when association names are shown", () => {
    useSettingsStore.setState({ showAssociationNames: true })
    renderEdgePanel(assoc())
    expect(screen.queryByText(/Hidden on the canvas/)).toBeNull()
  })

  it.each(["1", "0..1", "*", "1..*", "2..5", "(0,N)", "(1,1)", ""])(
    "accepts multiplicity %j",
    (value) => {
      renderEdgePanel(assoc({ sourceMultiplicity: value }))
      const input = screen.getByTestId("source-multiplicity")
      expect(input.getAttribute("aria-invalid")).toBe("false")
    }
  )

  it.each(["abc", "1..", "5..2", "1 .. *", "0..1..2"])(
    "flags multiplicity %j inline",
    (value) => {
      renderEdgePanel(assoc({ sourceMultiplicity: value }))
      const input = screen.getByTestId("source-multiplicity")
      expect(input.getAttribute("aria-invalid")).toBe("true")
      expect(screen.getByText(/Use e\.g\. 1, 0\.\.1/)).toBeTruthy()
    }
  )
})

/* -------------------------------------------------------------------------- */
/* 6. Enumeration switch on a connected class                                  */
/* -------------------------------------------------------------------------- */

describe("switching a connected class to Enumeration", () => {
  const setup = () => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes(twoClasses())
    store.getState().setEdges([assoc()])
    render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <StereotypeButtonGroup nodeId="A" />
      </DiagramStoreContext.Provider>
    )
    fireEvent.click(screen.getByRole("button", { name: "Enumeration" }))
    return store
  }
  const stereotypeOf = (store: StoreApi<DiagramStore>) =>
    (store.getState().nodes.find((n) => n.id === "A")!.data as ClassNodeProps)
      .stereotype

  it("warns instead of converting silently", () => {
    const store = setup()
    expect(screen.getByTestId("enumeration-relationships-warning").textContent).toMatch(
      /removes 1 relationship/
    )
    expect(stereotypeOf(store)).toBeUndefined()
    expect(store.getState().edges).toHaveLength(1)
  })

  it("converts and removes the relationships on confirm", () => {
    const store = setup()
    fireEvent.click(screen.getByRole("button", { name: "Remove and convert" }))
    expect(stereotypeOf(store)).toBe(ClassType.Enumeration)
    expect(store.getState().edges).toHaveLength(0)
  })

  it("cancel leaves the class and its relationships alone", () => {
    const store = setup()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(stereotypeOf(store)).toBeUndefined()
    expect(store.getState().edges).toHaveLength(1)
    expect(screen.queryByTestId("enumeration-relationships-warning")).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* 7, 8. Class pane details                                                    */
/* -------------------------------------------------------------------------- */

describe("class pane details", () => {
  afterEach(() => diagramBridge.clearDiagramData())

  const renderClassPanel = (nodes: Node[]) => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes(nodes)
    render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <ClassEditPanel elementId={nodes[0].id} />
      </DiagramStoreContext.Provider>
    )
    return store
  }

  it("no duplicate React keys when two classes share a name", () => {
    const nodes: Node[] = ["c1", "c2", "c3"].map((id) => ({
      id,
      type: "class",
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      data: {
        name: id === "c1" ? "Person" : "Dup",
        attributes: id === "c1" ? [{ id: "a", name: "x", attributeType: "str", visibility: "public" }] : [],
        methods: [],
      },
    }))
    diagramBridge.setClassDiagramData({ nodes, edges: [] } as never)
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    renderClassPanel(nodes)
    fireEvent.mouseDown(screen.getAllByLabelText("Attribute type")[0])
    const dupKeyErrors = spy.mock.calls.filter((c) =>
      String(c[0]).includes("same key")
    )
    spy.mockRestore()
    expect(dupKeyErrors).toEqual([])
    expect(screen.getAllByRole("option", { name: "Dup" })).toHaveLength(1)
  }, 20000)

  it("Enter on an empty add-attribute / add-method input adds nothing", () => {
    const store = renderClassPanel([
      {
        id: "c1",
        type: "class",
        position: { x: 0, y: 0 },
        width: 200,
        height: 100,
        data: { name: "Person", attributes: [], methods: [] },
      },
    ])
    fireEvent.keyDown(screen.getByLabelText("add attribute"), { key: "Enter" })
    fireEvent.keyDown(screen.getByLabelText("add method"), { key: "Enter" })
    const data = store.getState().nodes[0].data as ClassNodeProps
    expect(data.attributes).toHaveLength(0)
    expect(data.methods).toHaveLength(0)
  }, 20000)

  it("Typography forwards its ref, so Tooltips can anchor to it", () => {
    const ref = { current: null as HTMLElement | null }
    render(
      <Tooltip title="hint">
        <Typography ref={ref}>label</Typography>
      </Tooltip>
    )
    expect(ref.current?.textContent).toBe("label")
  })
})

/* -------------------------------------------------------------------------- */
/* 9. Object values                                                            */
/* -------------------------------------------------------------------------- */

describe("object attribute values", () => {
  beforeEach(() => diagramBridge.clearDiagramData())

  const renderObject = (attr: Record<string, unknown>) => {
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes([
      {
        id: "obj-1",
        type: "objectName",
        position: { x: 0, y: 0 },
        width: 200,
        height: 100,
        data: { name: "cart", attributes: [{ id: "a1", name: "v", ...attr }] },
      },
    ])
    const utils = render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <ObjectEditPanel elementId="obj-1" />
      </DiagramStoreContext.Provider>
    )
    const value = () =>
      (store.getState().nodes[0].data as ObjectNodeProps).attributes[0].value
    return { ...utils, value }
  }

  it("accepts a comma decimal on float values", () => {
    const { container, value } = renderObject({ attributeType: "float" })
    const input = container.querySelector(".bp-field__value input") as HTMLInputElement
    expect(input.type).toBe("text")
    fireEvent.change(input, { target: { value: "9,99" } })
    expect(value()).toBe("9.99")
  })

  it.each([
    ["localdate", "date"],
    ["timestamp", "datetime-local"],
    ["instant", "datetime-local"],
    ["localtime", "time"],
  ])("%s gets a native %s input", (type, inputType) => {
    const { container } = renderObject({ attributeType: type })
    const input = container.querySelector(".bp-field__value input") as HTMLInputElement
    expect(input.type).toBe(inputType)
  })

  it("shows a stored 'YYYY-MM-DD HH:MM:SS' value in a datetime input", () => {
    const { container } = renderObject({
      attributeType: "datetime",
      value: "2000-01-01 10:30:00",
    })
    const input = container.querySelector(".bp-field__value input") as HTMLInputElement
    expect(input.value).toBe("2000-01-01T10:30")
  })

  it("escapes quotes inside a string value on the canvas", () => {
    expect(
      formatObjectMember({ name: "quote", attributeType: "str", value: '"It"' })
    ).toBe('quote = "\\"It\\""')
  })
})
