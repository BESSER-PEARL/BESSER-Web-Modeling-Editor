/**
 * Wave-3 object-link connection validation tests.
 *
 * v3 source of truth: `components/uml-element/connectable/connectable.tsx`
 * (`canElementConnect`): when the hovered (target) element is a
 * class-linked object instance, the connection is allowed only when the
 * dragged-from (source) element links a class that shares at least one
 * association with the target's class (inheritance hierarchies folded by
 * `diagramBridge.getAvailableAssociations`). Unlinked targets stay
 * freely connectable.
 *
 * The v4 port is a diagram-scoped rule module
 * (`services/connectionRules/objectDiagramRules.ts`) consulted by the
 * shared `canConnectEndpoints` predicate that backs `isValidConnection`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  objectLinkConnectionRule,
  registerConnectionRule,
  evaluateConnectionRules,
} from "@/services/connectionRules"
import { canConnectEndpoints } from "@/utils/bpmnConstraints"
import { diagramBridge } from "@/services/diagramBridge"

/**
 * Class diagram: Person —owns→ Dog (association), Cat (no associations),
 * Puppy —inherits→ Dog.
 */
const classDiagramData = {
  nodes: [
    { id: "cls-person", type: "class", data: { name: "Person", attributes: [] } },
    { id: "cls-dog", type: "class", data: { name: "Dog", attributes: [] } },
    { id: "cls-cat", type: "class", data: { name: "Cat", attributes: [] } },
    { id: "cls-puppy", type: "class", data: { name: "Puppy", attributes: [] } },
  ],
  edges: [
    {
      id: "assoc-owns",
      type: "ClassBidirectional",
      source: "cls-person",
      target: "cls-dog",
      data: { name: "owns" },
    },
    {
      id: "inherit-puppy",
      type: "ClassInheritance",
      source: "cls-puppy",
      target: "cls-dog",
    },
  ],
}

const obj = (id: string, classId?: string) => ({
  id,
  type: "objectName",
  data: classId ? { name: id, classId } : { name: id },
})

// No direct `localStorage` access — unavailable in this jsdom env;
// the bridge guards its own persistence.
beforeEach(() => {
  diagramBridge.setClassDiagramData(classDiagramData)
})

afterEach(() => {
  diagramBridge.clearDiagramData()
})

describe("objectLinkConnectionRule", () => {
  it("allows linking instances whose classes share an association", () => {
    const result = objectLinkConnectionRule({
      nodes: [],
      sourceNode: obj("alice", "cls-person"),
      targetNode: obj("rex", "cls-dog"),
    })
    expect(result).toBe(true)
  })

  it("vetoes linking instances whose classes share no association", () => {
    const result = objectLinkConnectionRule({
      nodes: [],
      sourceNode: obj("whiskers", "cls-cat"),
      targetNode: obj("rex", "cls-dog"),
    })
    expect(result).toBe(false)
  })

  it("vetoes a class-linked target when the source instance is unlinked (v3 parity)", () => {
    const result = objectLinkConnectionRule({
      nodes: [],
      sourceNode: obj("anon"),
      targetNode: obj("rex", "cls-dog"),
    })
    expect(result).toBe(false)
  })

  it("has no opinion when the target instance is unlinked", () => {
    const result = objectLinkConnectionRule({
      nodes: [],
      sourceNode: obj("alice", "cls-person"),
      targetNode: obj("anon"),
    })
    expect(result).toBeUndefined()
  })

  it("folds inheritance: a Puppy instance connects to a Person instance via Dog's association", () => {
    const result = objectLinkConnectionRule({
      nodes: [],
      sourceNode: obj("alice", "cls-person"),
      targetNode: obj("spot", "cls-puppy"),
    })
    expect(result).toBe(true)
  })

  it("ignores classId-bearing nodes of other types (rule is objectName-scoped)", () => {
    const result = objectLinkConnectionRule({
      nodes: [],
      sourceNode: obj("anon"),
      targetNode: {
        id: "state-obj",
        type: "StateObjectNode",
        data: { name: "s", classId: "cls-dog" },
      },
    })
    expect(result).toBeUndefined()
  })
})

describe("canConnectEndpoints consults the object-diagram rules", () => {
  const nodes = [
    obj("alice", "cls-person"),
    obj("rex", "cls-dog"),
    obj("whiskers", "cls-cat"),
    obj("anon"),
  ]

  it("allows association-backed object links", () => {
    expect(canConnectEndpoints(nodes, "alice", "rex")).toBe(true)
  })

  it("rejects object links with no backing association", () => {
    expect(canConnectEndpoints(nodes, "whiskers", "rex")).toBe(false)
  })

  it("keeps unlinked targets connectable", () => {
    expect(canConnectEndpoints(nodes, "whiskers", "anon")).toBe(true)
  })

  it("still rejects Enumeration endpoints first (existing shared rule)", () => {
    const withEnum = [
      ...nodes,
      {
        id: "enum-1",
        type: "class",
        data: { name: "Color", stereotype: "Enumeration" },
      },
    ]
    expect(canConnectEndpoints(withEnum, "alice", "enum-1")).toBe(false)
  })
})

describe("connection-rule registry seam", () => {
  it("runs additional registered rules and supports unregistering", () => {
    const ctx = {
      nodes: [],
      sourceNode: obj("anon-a"),
      targetNode: obj("anon-b"),
    }
    expect(evaluateConnectionRules(ctx)).toBe(true)

    const unregister = registerConnectionRule(() => false)
    expect(evaluateConnectionRules(ctx)).toBe(false)

    unregister()
    expect(evaluateConnectionRules(ctx)).toBe(true)
  })
})
