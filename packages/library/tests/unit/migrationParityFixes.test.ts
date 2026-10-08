/**
 * Parity fixes found by the React Flow migration sweep (develop vs the new
 * editor). Each block records the observed failure.
 */
import { describe, it, expect, afterEach } from "vitest"
import { dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"
import { getUserMetaModelClasses } from "@/services/userMetaModel"
import {
  extractMethodSignatureFromCode,
  mergeParameterIds,
  parseMethodInput,
} from "@/utils/classifierMemberDisplay"
import { diagramBridge } from "@/services/diagramBridge"
import { resolveObjectHeaderLabel } from "@/components/svgs/nodes/objectDiagram"
import { canDropIntoParent } from "@/utils/bpmnConstraints"
import { isParentNodeType } from "@/utils/nodeUtils"
import { insertLaneIntoPool } from "@/components/DraggableGhost"
import type { Node } from "@xyflow/react"

describe("StateCodeBlock palette default name", () => {
  // The backend falls back to the `def` line's function name only when the
  // block name is empty; a pre-filled "code" name broke generation.
  it("drops with an empty name", () => {
    const entry = dropElementConfigs[UMLDiagramType.StateMachineDiagram].find(
      (e) => (e.type as string) === "StateCodeBlock"
    )
    expect(entry).toBeDefined()
    expect(entry!.defaultData?.name).toBe("")
  })
})

describe("UserDiagram 'User' palette card", () => {
  // Was a static unbound "Alice" (no classId), so linking User ->
  // Personal_Information was refused.
  it("is built from the metamodel User class, linked and named user_1", () => {
    const userClass = getUserMetaModelClasses().find((c) => c.name === "User")
    expect(userClass).toBeDefined()
    const cards = dropElementConfigs[UMLDiagramType.UserDiagram].filter(
      (e) => e.defaultData?.className === "User"
    )
    expect(cards).toHaveLength(1)
    expect(cards[0].defaultData?.classId).toBe(userClass!.id)
    expect(cards[0].defaultData?.name).toBe("user_1")
  })

  it("never offers an unbound card", () => {
    for (const e of dropElementConfigs[UMLDiagramType.UserDiagram]) {
      expect(e.defaultData?.classId).toBeTruthy()
    }
  })
})

describe("typed method signature with self and a default", () => {
  // Was parsed as [{name:"weeks", parameterType:"int = 2"}] with self
  // dropped; quality check then failed "Unknown type 'int = 2'".
  it("keeps self and stores the default separately", () => {
    const parsed = parseMethodInput("+ renew(self, weeks: int = 2): str")
    expect(parsed.name).toBe("renew")
    expect(parsed.returnType).toBe("str")
    expect(parsed.parameters).toEqual([
      { name: "self" },
      { name: "weeks", parameterType: "int", defaultValue: "2" },
    ])
  })

  it("does not split a default on commas inside quotes or brackets", () => {
    const parsed = parseMethodInput("f(a: str = 'x, y', b: list = [1, 2])")
    expect(parsed.parameters).toEqual([
      { name: "a", parameterType: "str", defaultValue: "x, y" },
      { name: "b", parameterType: "list", defaultValue: "[1, 2]" },
    ])
  })

  it("carries defaults through mergeParameterIds", () => {
    const merged = mergeParameterIds(
      [],
      [{ name: "weeks", parameterType: "int", defaultValue: "2" }]
    )
    expect(merged[0]).toMatchObject({
      name: "weeks",
      parameterType: "int",
      defaultValue: "2",
    })
  })

  it("code def-line extraction still drops self (develop parity)", () => {
    const sig = extractMethodSignatureFromCode(
      "def renew(self, weeks: int = 2) -> str:\n    pass"
    )
    expect(sig?.parameters).toEqual([
      { name: "weeks", parameterType: "int", defaultValue: "2" },
    ])
  })
})

describe("object header after its class is deleted", () => {
  afterEach(() => diagramBridge.clearDiagramData())

  // Showed "library_1 : Library" from the cached className; develop
  // dropped the deleted class's name.
  it("drops the stale class name when the class diagram no longer has it", () => {
    diagramBridge.setClassDiagramData({
      nodes: [{ id: "other", type: "class", data: { name: "Book", attributes: [] } }],
      edges: [],
    })
    expect(
      resolveObjectHeaderLabel({
        name: "library_1",
        classId: "deleted",
        className: "Library",
      })
    ).toBe("library_1")
  })

  it("keeps the cached name when the bridge has no class data", () => {
    diagramBridge.clearDiagramData()
    expect(
      resolveObjectHeaderLabel({
        name: "library_1",
        classId: "c1",
        className: "Library",
      })
    ).toBe("library_1 : Library")
  })
})

describe("BPMN call activity is not a container", () => {
  // It swallowed dropped elements as children; develop's CallActivity was
  // `droppable: false`.
  it("rejects children and is not a parent type", () => {
    expect(canDropIntoParent("bpmnTask", "bpmnCallActivity")).toBe(false)
    expect(isParentNodeType("bpmnCallActivity")).toBe(false)
  })

  it("can still be dropped into pools, lanes and subprocesses", () => {
    expect(canDropIntoParent("bpmnCallActivity", "bpmnPool")).toBe(true)
    expect(canDropIntoParent("bpmnCallActivity", "bpmnSwimlane")).toBe(true)
    expect(canDropIntoParent("bpmnCallActivity", "bpmnSubprocess")).toBe(true)
  })
})

describe("dropping a lane into a pool that already holds a task", () => {
  // The task was re-parented under the new lane but stayed listed before
  // it, so React Flow threw it out of the pool on the next click.
  it("lists the lane before the task it adopts", () => {
    const nodes: Node[] = [
      { id: "pool", type: "bpmnPool", position: { x: 0, y: 0 }, width: 480, height: 200, data: {} },
      { id: "task", type: "bpmnTask", parentId: "pool", position: { x: 120, y: 70 }, width: 160, height: 60, data: {} },
      { id: "lane", type: "bpmnSwimlane", parentId: "pool", position: { x: 40, y: 0 }, width: 440, height: 200, data: {} },
    ]
    const out = insertLaneIntoPool(nodes, "lane", "pool")
    const ids = out.map((n) => n.id)
    expect(out.find((n) => n.id === "task")!.parentId).toBe("lane")
    expect(ids.indexOf("lane")).toBeLessThan(ids.indexOf("task"))
    expect(ids.indexOf("pool")).toBeLessThan(ids.indexOf("lane"))
  })
})
