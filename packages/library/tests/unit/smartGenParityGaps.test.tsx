// Public entry first so module-evaluation order matches the webapp.
import "@/index"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Edge, Node } from "@xyflow/react"
import { ReactFlowProvider } from "@xyflow/react"
import type { StoreApi } from "zustand"
import {
  AssessmentSelectionStoreContext,
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
} from "@/store/context"
import { createAssessmentSelectionStore } from "@/store/assessmentSelectionStore"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore, MetadataStore } from "@/store/metadataStore"
import { createPopoverStore } from "@/store/popoverStore"
import { diagramBridge } from "@/services/diagramBridge"
import { settingsService } from "@/services/settingsService"
import { dropElementConfigs } from "@/constants"
import { BesserMode } from "@/typings"
import { UMLDiagramType } from "@/types"
import {
  buildAssociatedObject,
  getAssociatedObjectTargets,
  ASSOCIATED_OBJECT_VERTICAL_GAP,
} from "@/utils/associatedObject"
import { AddAssociatedObjectButton } from "@/components/toolbars/AddAssociatedObjectButton"
import { ActivityMergeNodeEditPanel } from "@/components/inspectors/activityDiagram"
import { StateMergeNodeEditPanel } from "@/components/inspectors/stateMachineDiagram"
import { NodeAssessmentBadge } from "@/components/wrapper/NodeAssessmentBadge"
import { ClassEditPanel } from "@/components/inspectors/classDiagram/ClassEditPanel"
import { Sidebar } from "@/components/Sidebar"
import { convertV3NodeTypeToV4 } from "@/utils/versionConverter"
import type { ClassNodeProps } from "@/types"

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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const makeStores = (
  nodes: Node[] = [],
  edges: Edge[] = [],
  diagramType: UMLDiagramType = UMLDiagramType.ObjectDiagram
) => {
  const ydoc = new Y.Doc()
  const diagram = createDiagramStore(ydoc)
  const metadata = createMetadataStore(ydoc)
  const popover = createPopoverStore()
  diagram.getState().setNodesAndEdges(nodes, edges)
  metadata.getState().updateMetaData("Test", diagramType)
  return { diagram, metadata, popover }
}

const renderWith = (
  ui: React.ReactElement,
  stores: ReturnType<typeof makeStores>
) =>
  render(
    <ReactFlowProvider>
      <DiagramStoreContext.Provider
        value={stores.diagram as StoreApi<DiagramStore>}
      >
        <MetadataStoreContext.Provider
          value={stores.metadata as StoreApi<MetadataStore>}
        >
          <PopoverStoreContext.Provider value={stores.popover}>
            <AssessmentSelectionStoreContext.Provider
              value={createAssessmentSelectionStore()}
            >
              {ui}
            </AssessmentSelectionStoreContext.Provider>
          </PopoverStoreContext.Provider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    </ReactFlowProvider>
  )

/** Minimal v4 class diagram: Person —— Address (plain association). */
const classDiagramData = {
  nodes: [
    {
      id: "cls-person",
      type: "class",
      data: {
        name: "Person",
        attributes: [
          {
            id: "a-name",
            name: "name",
            attributeType: "str",
            visibility: "public",
          },
        ],
      },
    },
    {
      id: "cls-address",
      type: "class",
      data: {
        name: "Address",
        attributes: [
          {
            id: "a-city",
            name: "city",
            attributeType: "str",
            visibility: "public",
            defaultValue: "Esch",
          },
        ],
      },
    },
  ],
  edges: [
    {
      id: "assoc-1",
      type: "ClassBidirectional",
      source: "cls-person",
      target: "cls-address",
    },
  ],
}

const personObject = (): Node => ({
  id: "obj-person",
  type: "objectName",
  position: { x: 40, y: 60 },
  width: 160,
  height: 70,
  data: {
    name: "person_1",
    classId: "cls-person",
    className: "Person",
    attributes: [],
    methods: [],
  },
})

beforeEach(() => {
  settingsService.resetToDefaults()
  diagramBridge.clearDiagramData()
})
afterEach(() => {
  settingsService.resetToDefaults()
  diagramBridge.clearDiagramData()
})

/* -------------------------------------------------------------------------- */
/* Gap 2 — add associated object                                              */
/* -------------------------------------------------------------------------- */

describe("add associated object (v3 association-popup)", () => {
  it("lists the related classes of the object's class", () => {
    diagramBridge.setClassDiagramData(classDiagramData)
    expect(getAssociatedObjectTargets(personObject())).toEqual([
      { id: "cls-address", name: "Address" },
    ])
    // Unbound object → nothing to connect to.
    expect(
      getAssociatedObjectTargets({ ...personObject(), data: { name: "x" } })
    ).toEqual([])
  })

  it("clones the palette instance card and links it below the source", () => {
    diagramBridge.setClassDiagramData(classDiagramData)
    const palette = dropElementConfigs[UMLDiagramType.ObjectDiagram]
    const created = buildAssociatedObject({
      sourceNode: personObject(),
      targetClassId: "cls-address",
      diagramType: UMLDiagramType.ObjectDiagram,
      paletteEntries: palette,
    })!
    expect(created).not.toBeNull()
    const card = palette.find((e) => e.defaultData?.classId === "cls-address")!
    expect(created.node.type).toBe("objectName")
    expect(created.node.data).toMatchObject({
      name: "address_1",
      classId: "cls-address",
      className: "Address",
    })
    // Row ids are regenerated (no collision with the palette template).
    const rows = created.node.data.attributes as { id: string }[]
    const cardRows = card.defaultData!.attributes as { id: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0].id).not.toBe(cardRows[0].id)
    expect(created.node.position).toEqual({
      x: 40,
      y: 60 + 70 + ASSOCIATED_OBJECT_VERTICAL_GAP,
    })
    expect(created.edge).toMatchObject({
      source: "obj-person",
      target: created.node.id,
      type: "ObjectLink",
      sourceHandle: "bottom",
      targetHandle: "top",
    })
  })

  it("falls back to the class info when the palette has no instance card", () => {
    diagramBridge.setClassDiagramData(classDiagramData)
    const created = buildAssociatedObject({
      sourceNode: personObject(),
      targetClassId: "cls-address",
      diagramType: UMLDiagramType.ObjectDiagram,
      paletteEntries: [],
    })!
    expect(created.node.data).toMatchObject({
      name: "address_1",
      classId: "cls-address",
      attributes: [
        expect.objectContaining({
          name: "city",
          attributeId: "a-city",
          value: "Esch",
        }),
      ],
    })
  })

  it("uses UserModelLink in the UserDiagram", () => {
    diagramBridge.setClassDiagramData(classDiagramData)
    const created = buildAssociatedObject({
      sourceNode: { ...personObject(), type: "UserModelName" },
      targetClassId: "cls-address",
      diagramType: UMLDiagramType.UserDiagram,
      paletteEntries: [],
    })!
    expect(created.node.type).toBe("UserModelName")
    expect(created.edge.type).toBe("UserModelLink")
  })

  it("toolbar button opens the popup and creates object + link", () => {
    diagramBridge.setClassDiagramData(classDiagramData)
    const stores = makeStores([personObject()])
    renderWith(<AddAssociatedObjectButton elementId="obj-person" />, stores)

    fireEvent.click(screen.getByTestId("add-associated-object-obj-person"))
    expect(
      screen.getByText("Add and connect to new Object")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Address" }))

    const { nodes, edges } = stores.diagram.getState()
    expect(nodes).toHaveLength(2)
    expect(edges).toHaveLength(1)
    expect(edges[0].type).toBe("ObjectLink")
  })

  it("shows the no-targets message for an unbound object", () => {
    const stores = makeStores([
      { ...personObject(), data: { name: "x", attributes: [] } },
    ])
    renderWith(<AddAssociatedObjectButton elementId="obj-person" />, stores)
    fireEvent.click(screen.getByTestId("add-associated-object-obj-person"))
    expect(
      screen.getByText("No other objects available to connect to")
    ).toBeInTheDocument()
  })

  it("is not offered outside object / user diagrams", () => {
    const stores = makeStores([personObject()], [], UMLDiagramType.ClassDiagram)
    renderWith(<AddAssociatedObjectButton elementId="obj-person" />, stores)
    expect(screen.queryByTestId("add-associated-object-obj-person")).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Gap 3 — generic assessment score badge                                     */
/* -------------------------------------------------------------------------- */

describe("NodeAssessmentBadge", () => {
  const withScore = (mode: BesserMode) => {
    const stores = makeStores([], [], UMLDiagramType.StateMachineDiagram)
    stores.metadata.getState().setMode(mode)
    stores.diagram.getState().setAssessments({
      "st-1": {
        modelElementId: "st-1",
        elementType: "node",
        score: 2,
      },
    })
    return stores
  }

  it("renders the score icon for node types whose SVG draws none", () => {
    renderWith(
      <NodeAssessmentBadge elementId="st-1" nodeType="State" />,
      withScore(BesserMode.Assessment)
    )
    expect(screen.getByTestId("assessment-badge-st-1")).toBeInTheDocument()
  })

  it("stays out of the way for types that draw their own icon", () => {
    renderWith(
      <NodeAssessmentBadge elementId="st-1" nodeType="class" />,
      withScore(BesserMode.Assessment)
    )
    expect(screen.queryByTestId("assessment-badge-st-1")).toBeNull()
  })

  it("is hidden while modelling", () => {
    renderWith(
      <NodeAssessmentBadge elementId="st-1" nodeType="State" />,
      withScore(BesserMode.Modelling)
    )
    expect(screen.queryByTestId("assessment-badge-st-1")).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Gap 8 / 9 — merge-node inspectors                                          */
/* -------------------------------------------------------------------------- */

describe("ActivityMergeNodeEditPanel (v3 per-outgoing-flow conditions)", () => {
  const nodes: Node[] = [
    {
      id: "merge",
      type: "activityMergeNode",
      position: { x: 0, y: 0 },
      width: 80,
      height: 80,
      data: { name: "check" },
    },
    {
      id: "yes",
      type: "activityActionNode",
      position: { x: 0, y: 200 },
      width: 160,
      height: 60,
      data: { name: "Ship order" },
    },
  ]
  const edges: Edge[] = [
    {
      id: "flow-1",
      type: "ActivityControlFlow",
      source: "merge",
      target: "yes",
      data: { label: "paid" },
    },
  ]

  it("lists each outgoing flow with its target and edits the guard", () => {
    const stores = makeStores(nodes, edges, UMLDiagramType.ActivityDiagram)
    renderWith(<ActivityMergeNodeEditPanel elementId="merge" />, stores)
    expect(screen.getByText("Ship order")).toBeInTheDocument()
    const guard = screen.getByDisplayValue("paid")
    fireEvent.change(guard, { target: { value: "paid in full" } })
    expect(stores.diagram.getState().edges[0].data?.label).toBe("paid in full")
  })

  it("hides the conditions section without outgoing flows", () => {
    const stores = makeStores(nodes, [], UMLDiagramType.ActivityDiagram)
    renderWith(<ActivityMergeNodeEditPanel elementId="merge" />, stores)
    expect(screen.queryByText("Conditions")).toBeNull()
  })
})

describe("StateMergeNodeEditPanel width / height (v3 SizeInput)", () => {
  it("writes numeric width / height onto the node", () => {
    const stores = makeStores(
      [
        {
          id: "sm",
          type: "StateMergeNode",
          position: { x: 0, y: 0 },
          width: 80,
          height: 80,
          data: { name: "" },
        },
      ],
      [],
      UMLDiagramType.StateMachineDiagram
    )
    renderWith(<StateMergeNodeEditPanel elementId="sm" />, stores)
    fireEvent.change(screen.getByLabelText("Width"), {
      target: { value: "140" },
    })
    fireEvent.change(screen.getByLabelText("Height"), {
      target: { value: "90" },
    })
    // Non-numeric input is ignored (v3 isNaN guard).
    fireEvent.change(screen.getByLabelText("Height"), {
      target: { value: "" },
    })
    const node = stores.diagram.getState().nodes[0]
    expect(node.width).toBe(140)
    expect(node.height).toBe(90)
  })
})

/* -------------------------------------------------------------------------- */
/* Gap 5 — user palette gated by "Show Instanced Objects"                     */
/* -------------------------------------------------------------------------- */

describe("UserDiagram palette gating", () => {
  const metaCards = () =>
    dropElementConfigs[UMLDiagramType.UserDiagram].filter(
      (e) => e.defaultData?.classId
    )

  it("shows the per-metaclass cards only while instances are shown", () => {
    settingsService.updateSetting("showInstancedObjects", true)
    expect(metaCards().length).toBeGreaterThan(0)
    settingsService.updateSetting("showInstancedObjects", false)
    expect(metaCards()).toHaveLength(0)
    // The static fallback card stays available.
    expect(dropElementConfigs[UMLDiagramType.UserDiagram]).toHaveLength(1)
  })
})

/* -------------------------------------------------------------------------- */
/* Gap 6 — icon-mode checkbox in the canvas sidebar                           */
/* -------------------------------------------------------------------------- */

describe("Sidebar icon-mode checkbox", () => {
  it("toggles settingsService.showIconView on the ObjectDiagram", () => {
    const stores = makeStores([], [], UMLDiagramType.ObjectDiagram)
    renderWith(<Sidebar />, stores)
    const box = screen.getByLabelText(
      "Display Object Diagram in Icon Mode"
    ) as HTMLInputElement
    expect(box.checked).toBe(false)
    act(() => {
      fireEvent.click(box)
    })
    expect(settingsService.shouldShowIconView()).toBe(true)
    // External change (e.g. webapp Project Settings) is reflected.
    act(() => settingsService.updateSetting("showIconView", false))
    expect(box.checked).toBe(false)
  })

  it("is not shown for other diagrams (UserDiagram is always icon view)", () => {
    const stores = makeStores([], [], UMLDiagramType.UserDiagram)
    renderWith(<Sidebar />, stores)
    expect(
      screen.queryByLabelText("Display Object Diagram in Icon Mode")
    ).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Gap 7 — class "📝 Code" quick-create                                        */
/* -------------------------------------------------------------------------- */

describe("ClassEditPanel 📝 Code quick-create", () => {
  const classNode = (): Node => ({
    id: "class-1",
    type: "class",
    position: { x: 0, y: 0 },
    width: 200,
    height: 110,
    data: { name: "Person", attributes: [], methods: [] },
  })
  const methods = (store: StoreApi<DiagramStore>) =>
    (store.getState().nodes[0].data as ClassNodeProps).methods

  it("creates a code-behaviour method with the v3 template", () => {
    const stores = makeStores([classNode()], [], UMLDiagramType.ClassDiagram)
    renderWith(<ClassEditPanel elementId="class-1" />, stores)
    fireEvent.click(
      screen.getByRole("button", { name: "Create method with code behaviour" })
    )
    const [method] = methods(stores.diagram)
    expect(method.name).toBe("new_method")
    expect(method.implementationType).toBe("code")
    expect(method.code).toBe(
      'def new_method(self):\n    """Add your docstring here."""\n    # Add your implementation here\n    pass\n'
    )
  })

  it("names the method from the pending add-method input", () => {
    const stores = makeStores([classNode()], [], UMLDiagramType.ClassDiagram)
    renderWith(<ClassEditPanel elementId="class-1" />, stores)
    fireEvent.change(screen.getByPlaceholderText("+ Add method (Enter)"), {
      target: { value: "greet" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Create method with code behaviour" })
    )
    const all = methods(stores.diagram)
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe("greet")
    expect(all[0].code?.startsWith("def greet(self):")).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/* Gap 11 — v3 ColorLegend                                                    */
/* -------------------------------------------------------------------------- */

describe("v3 ColorLegend migration", () => {
  it("maps the v3 ColorLegend element type onto colorDescription", () => {
    expect(convertV3NodeTypeToV4("ColorLegend")).toBe("colorDescription")
  })
})
