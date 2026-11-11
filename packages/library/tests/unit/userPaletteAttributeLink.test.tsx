/**
 * Rows of a UserModelName dropped from the palette stay linked to their
 * meta-class attribute (`attributeId`), so the inspector shows the fixed
 * attribute name and an enum-aware value editor instead of an ad-hoc row.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import * as Y from "yjs"
import type { Node } from "@xyflow/react"
import type { StoreApi } from "zustand"
import { dropElementConfigs } from "@/constants"
import { cloneDefaultDataWithFreshRowIds } from "@/components/DraggableGhost"
import { UserModelNameEditPanel } from "@/components/inspectors/userDiagram/UserModelNameEditPanel"
import { getUserMetaModelClasses } from "@/services/userMetaModel"
import { DiagramStoreContext } from "@/store/context"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { UMLDiagramType } from "@/types"

afterEach(cleanup)

type Row = { id: string; name: string; attributeId?: string }

const droppedData = (className: string) => {
  const entry = dropElementConfigs[UMLDiagramType.UserDiagram].find(
    (e) => e.defaultData?.className === className
  )!
  return cloneDefaultDataWithFreshRowIds(entry.defaultData!) as {
    attributes: Row[]
  }
}

describe("UserDiagram palette rows", () => {
  it("every dropped row references its meta-class attribute", () => {
    for (const metaClass of getUserMetaModelClasses()) {
      const rows = droppedData(metaClass.name).attributes
      expect(rows.map((r) => r.attributeId)).toEqual(
        metaClass.attributes.map((a) => a.id)
      )
      // The row itself gets a fresh id per drop.
      for (const row of rows) expect(row.id).not.toBe(row.attributeId)
    }
  })

  it("the inspector shows dropped rows as linked, not free-text", () => {
    const metaClass = getUserMetaModelClasses().find(
      (c) => c.attributes.length > 0
    )!
    const node: Node = {
      id: "user-1",
      type: "UserModelName",
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      data: droppedData(metaClass.name),
    }
    const store = createDiagramStore(new Y.Doc())
    store.getState().setNodes([node])
    render(
      <DiagramStoreContext.Provider value={store as StoreApi<DiagramStore>}>
        <UserModelNameEditPanel elementId="user-1" />
      </DiagramStoreContext.Provider>
    )
    expect(screen.queryByPlaceholderText("attribute name")).toBeNull()
    expect(screen.getAllByText(metaClass.attributes[0].name).length).toBeGreaterThan(0)
  })
})
