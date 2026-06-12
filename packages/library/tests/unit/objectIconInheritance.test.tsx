/**
 * Wave-3 sweep (A6): the object inspector's class picker must copy the
 * linked class's icon onto the object node — develop's per-class palette
 * instances copied `classInfo.icon`, and the migration palette path does
 * too (`objectDiagramPalette.test.ts`); changing the class from the
 * inspector has to match, and unlinking drops the inherited glyph.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { ObjectEditPanel } from "@/components/inspectors/objectDiagram/ObjectEditPanel"
import { ObjectNodeProps } from "@/types"
import { diagramBridge } from "@/services/diagramBridge"

const DOG_ICON = "<svg><circle r='4'/></svg>"

const classDiagramData = {
  nodes: [
    {
      id: "node-Dog",
      type: "class",
      data: {
        name: "Dog",
        icon: DOG_ICON,
        attributes: [
          { id: "attr-name", name: "name", attributeType: "str", visibility: "public" },
        ],
      },
    },
    {
      id: "node-Animal",
      type: "class",
      data: { name: "Animal", attributes: [] },
    },
  ],
  edges: [],
}

const objectNode = (data: Partial<ObjectNodeProps> = {}): Node => ({
  id: "obj-1",
  type: "objectName",
  position: { x: 0, y: 0 },
  width: 200,
  height: 100,
  data: {
    name: "rex",
    attributes: [],
    ...data,
  },
})

const renderPanel = (nodes: Node[]) => {
  const store = createDiagramStore(new Y.Doc())
  store.getState().setNodes(nodes)
  const utils = render(
    <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
      <ObjectEditPanel elementId="obj-1" />
    </DiagramStoreContext.Provider>
  )
  return { store, ...utils }
}

const getData = (store: StoreApi<DiagramStore>): ObjectNodeProps =>
  store.getState().nodes.find((n) => n.id === "obj-1")!.data as ObjectNodeProps

const pickClassOption = (optionLabel: RegExp) => {
  // The class picker is the first combobox in the panel (object nodes
  // without attribute rows render no other selects above it).
  const combo = screen.getAllByRole("combobox")[0]
  fireEvent.mouseDown(combo)
  const option = screen
    .getAllByRole("option")
    .find((o) => optionLabel.test(o.textContent ?? ""))!
  expect(option).toBeDefined()
  fireEvent.click(option)
}

beforeEach(() => {
  diagramBridge.clearDiagramData()
  diagramBridge.setClassDiagramData(classDiagramData)
})

afterEach(() => {
  diagramBridge.clearDiagramData()
})

describe("ObjectEditPanel — icon inheritance from the linked class", () => {
  it("copies the class icon onto the node when a class is selected", () => {
    const { store } = renderPanel([objectNode()])

    pickClassOption(/Dog/)

    const data = getData(store)
    expect(data.classId).toBe("node-Dog")
    expect(data.className).toBe("Dog")
    expect(data.icon).toBe(DOG_ICON)
  })

  it("clears a stale icon when switching to an icon-less class", () => {
    const { store } = renderPanel([
      objectNode({ classId: "node-Dog", className: "Dog", icon: DOG_ICON }),
    ])

    pickClassOption(/Animal/)

    const data = getData(store)
    expect(data.classId).toBe("node-Animal")
    expect(data.icon).toBeUndefined()
  })

  it("drops the inherited icon when unlinking", () => {
    const { store } = renderPanel([
      objectNode({ classId: "node-Dog", className: "Dog", icon: DOG_ICON }),
    ])

    pickClassOption(/Unlinked/)

    const data = getData(store)
    expect(data.classId).toBeUndefined()
    expect(data.icon).toBeUndefined()
  })
})
