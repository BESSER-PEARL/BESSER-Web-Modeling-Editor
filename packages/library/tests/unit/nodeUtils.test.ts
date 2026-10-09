import { describe, it, expect, vi } from "vitest"

// Mock @/nodes to avoid the deep import chain that triggers generateUUID at module level
vi.mock("@/nodes", () => ({
  DiagramNodeTypeRecord: {
    package: "package",
    class: "class",
    objectName: "objectName",
    communicationObjectName: "communicationObjectName",
    colorDescription: "colorDescription",
    titleAndDesctiption: "titleAndDesctiption",
    activity: "activity",
    activityInitialNode: "activityInitialNode",
    activityFinalNode: "activityFinalNode",
    activityActionNode: "activityActionNode",
    activityObjectNode: "activityObjectNode",
    activityMergeNode: "activityMergeNode",
    activityForkNode: "activityForkNode",
    activityForkNodeHorizontal: "activityForkNodeHorizontal",
    useCase: "useCase",
    useCaseActor: "useCaseActor",
    useCaseSystem: "useCaseSystem",
    component: "component",
    componentInterface: "componentInterface",
    componentSubsystem: "componentSubsystem",
    deploymentNode: "deploymentNode",
    deploymentComponent: "deploymentComponent",
    deploymentArtifact: "deploymentArtifact",
    deploymentInterface: "deploymentInterface",
    flowchartTerminal: "flowchartTerminal",
    flowchartProcess: "flowchartProcess",
    flowchartDecision: "flowchartDecision",
    flowchartInputOutput: "flowchartInputOutput",
    flowchartFunctionCall: "flowchartFunctionCall",
    syntaxTreeTerminal: "syntaxTreeTerminal",
    syntaxTreeNonterminal: "syntaxTreeNonterminal",
    petriNetTransition: "petriNetTransition",
    petriNetPlace: "petriNetPlace",
    bpmnTask: "bpmnTask",
    bpmnStartEvent: "bpmnStartEvent",
    bpmnIntermediateEvent: "bpmnIntermediateEvent",
    bpmnEndEvent: "bpmnEndEvent",
    bpmnGateway: "bpmnGateway",
    bpmnSubprocess: "bpmnSubprocess",
    bpmnTransaction: "bpmnTransaction",
    bpmnCallActivity: "bpmnCallActivity",
    bpmnAnnotation: "bpmnAnnotation",
    bpmnDataObject: "bpmnDataObject",
    bpmnDataStore: "bpmnDataStore",
    bpmnPool: "bpmnPool",
    bpmnGroup: "bpmnGroup",
    reachabilityGraphMarking: "reachabilityGraphMarking",
    sfcStart: "sfcStart",
    sfcStep: "sfcStep",
    sfcActionTable: "sfcActionTable",
    sfcTransitionBranch: "sfcTransitionBranch",
    sfcJump: "sfcJump",
  },
}))

import {
  getPositionOnCanvas,
  resizeAllParents,
  sortNodesTopologically,
  isParentNodeType,
} from "@/utils/nodeUtils"
import type { Node } from "@xyflow/react"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<Node> & { id: string }): Node {
  return {
    position: { x: 0, y: 0 },
    data: {},
    ...overrides,
  } as Node
}

// ---------------------------------------------------------------------------
// getPositionOnCanvas
// ---------------------------------------------------------------------------

describe("getPositionOnCanvas", () => {
  it("returns the node position when it has no parent", () => {
    const node = makeNode({ id: "a", position: { x: 10, y: 20 } })
    expect(getPositionOnCanvas(node, [node])).toEqual({ x: 10, y: 20 })
  })

  it("accumulates a single parent position", () => {
    const parent = makeNode({ id: "p", position: { x: 100, y: 200 } })
    const child = makeNode({
      id: "c",
      position: { x: 5, y: 10 },
      parentId: "p",
    })
    expect(getPositionOnCanvas(child, [parent, child])).toEqual({
      x: 105,
      y: 210,
    })
  })

  it("accumulates through multiple ancestor levels", () => {
    const grandparent = makeNode({
      id: "gp",
      position: { x: 100, y: 100 },
    })
    const parent = makeNode({
      id: "p",
      position: { x: 50, y: 50 },
      parentId: "gp",
    })
    const child = makeNode({
      id: "c",
      position: { x: 10, y: 10 },
      parentId: "p",
    })
    expect(getPositionOnCanvas(child, [grandparent, parent, child])).toEqual({
      x: 160,
      y: 160,
    })
  })

  it("handles parentId pointing to a nonexistent node", () => {
    const node = makeNode({
      id: "a",
      position: { x: 5, y: 5 },
      parentId: "missing",
    })
    expect(getPositionOnCanvas(node, [node])).toEqual({ x: 5, y: 5 })
  })

  it("does not mutate the original node position", () => {
    const parent = makeNode({ id: "p", position: { x: 100, y: 200 } })
    const child = makeNode({
      id: "c",
      position: { x: 5, y: 10 },
      parentId: "p",
    })
    getPositionOnCanvas(child, [parent, child])
    expect(child.position).toEqual({ x: 5, y: 10 })
  })
})

// ---------------------------------------------------------------------------
// resizeAllParents
// ---------------------------------------------------------------------------

describe("resizeAllParents", () => {
  // Containers only grow to fit their children, like develop's
  // `UMLPackage.render` (bounding box of the container plus its children).
  it("shifts parent when child has negative x position", () => {
    const parent = makeNode({
      id: "p",
      position: { x: 100, y: 100 },
      width: 200,
      height: 200,
    })
    const child = makeNode({
      id: "c",
      position: { x: -20, y: 50 },
      parentId: "p",
      width: 50,
      height: 50,
    })
    resizeAllParents(child, [parent, child])
    expect(parent.position.x).toBe(80)
    expect(child.position.x).toBe(0)
    expect(parent.width).toBe(220)
  })

  it("shifts parent when child has negative y position", () => {
    const parent = makeNode({
      id: "p",
      position: { x: 0, y: 100 },
      width: 200,
      height: 200,
    })
    const child = makeNode({
      id: "c",
      position: { x: 10, y: -30 },
      parentId: "p",
      width: 50,
      height: 50,
    })
    resizeAllParents(child, [parent, child])
    expect(parent.position.y).toBe(70)
    expect(child.position.y).toBe(0)
    expect(parent.height).toBe(230)
  })

  it("grows parent when child extends beyond right edge", () => {
    const parent = makeNode({
      id: "p",
      position: { x: 0, y: 0 },
      width: 100,
      height: 100,
    })
    const child = makeNode({
      id: "c",
      position: { x: 80, y: 10 },
      parentId: "p",
      width: 50,
      height: 20,
    })
    resizeAllParents(child, [parent, child])
    expect(parent.width).toBe(130)
    expect(child.position).toEqual({ x: 80, y: 10 })
  })

  it("grows parent when child extends beyond bottom edge", () => {
    const parent = makeNode({
      id: "p",
      position: { x: 0, y: 0 },
      width: 100,
      height: 100,
    })
    const child = makeNode({
      id: "c",
      position: { x: 10, y: 80 },
      parentId: "p",
      width: 20,
      height: 50,
    })
    resizeAllParents(child, [parent, child])
    expect(parent.height).toBe(130)
    expect(child.position).toEqual({ x: 10, y: 80 })
  })

  it("keeps a resized deployment node's size and the dropped child's position", () => {
    // Live repro: a 375x295 node shrank to 180x120 around the first
    // component dropped into it, and the component jumped to (10, 10).
    const node = makeNode({
      id: "n",
      type: "deploymentNode",
      position: { x: 100, y: 100 },
      width: 375,
      height: 295,
    })
    const component = makeNode({
      id: "c",
      type: "deploymentComponent",
      position: { x: 105, y: 110 },
      parentId: "n",
      width: 160,
      height: 100,
    })
    resizeAllParents(component, [node, component])
    expect(node.position).toEqual({ x: 100, y: 100 })
    expect({ width: node.width, height: node.height }).toEqual({
      width: 375,
      height: 295,
    })
    expect(component.position).toEqual({ x: 105, y: 110 })
  })

  it("returns the mutated allNodes array", () => {
    const parent = makeNode({
      id: "p",
      position: { x: 0, y: 0 },
      width: 100,
      height: 100,
    })
    const child = makeNode({
      id: "c",
      position: { x: 10, y: 10 },
      parentId: "p",
      width: 20,
      height: 20,
    })
    const all = [parent, child]
    expect(resizeAllParents(child, all)).toBe(all)
  })

  it("propagates resizing up multiple parent levels", () => {
    const gp = makeNode({
      id: "gp",
      position: { x: 0, y: 0 },
      width: 100,
      height: 100,
    })
    const parent = makeNode({
      id: "p",
      position: { x: 10, y: 10 },
      parentId: "gp",
      width: 100,
      height: 100,
    })
    const child = makeNode({
      id: "c",
      position: { x: 80, y: 80 },
      parentId: "p",
      width: 50,
      height: 50,
    })
    resizeAllParents(child, [gp, parent, child])
    expect({ width: parent.width, height: parent.height }).toEqual({
      width: 130,
      height: 130,
    })
    expect({ width: gp.width, height: gp.height }).toEqual({
      width: 140,
      height: 140,
    })
  })
})

// ---------------------------------------------------------------------------
// sortNodesTopologically
// ---------------------------------------------------------------------------

describe("sortNodesTopologically", () => {
  it("returns empty array for empty input", () => {
    expect(sortNodesTopologically([])).toEqual([])
  })

  it("returns nodes in order when no parent relationships exist", () => {
    const a = makeNode({ id: "a" })
    const b = makeNode({ id: "b" })
    const result = sortNodesTopologically([a, b])
    expect(result).toHaveLength(2)
  })

  it("puts parents before children", () => {
    const parent = makeNode({ id: "p" })
    const child = makeNode({ id: "c", parentId: "p" })
    // Provide child first to ensure sort reorders
    const result = sortNodesTopologically([child, parent])
    const ids = result.map((n) => n.id)
    expect(ids.indexOf("p")).toBeLessThan(ids.indexOf("c"))
  })

  it("handles deep hierarchies (3 levels)", () => {
    const gp = makeNode({ id: "gp" })
    const p = makeNode({ id: "p", parentId: "gp" })
    const c = makeNode({ id: "c", parentId: "p" })
    const result = sortNodesTopologically([c, p, gp])
    const ids = result.map((n) => n.id)
    expect(ids).toEqual(["gp", "p", "c"])
  })

  it("throws on circular dependency", () => {
    const a = makeNode({ id: "a", parentId: "b" })
    const b = makeNode({ id: "b", parentId: "a" })
    expect(() => sortNodesTopologically([a, b])).toThrow(
      /[Cc]ircular dependency/
    )
  })

  it("handles node with missing parent gracefully", () => {
    const node = makeNode({ id: "n", parentId: "nonexistent" })
    // should not throw, just warns
    const result = sortNodesTopologically([node])
    expect(result).toHaveLength(1)
  })

  it("handles multiple independent subtrees", () => {
    const p1 = makeNode({ id: "p1" })
    const c1 = makeNode({ id: "c1", parentId: "p1" })
    const p2 = makeNode({ id: "p2" })
    const c2 = makeNode({ id: "c2", parentId: "p2" })
    const result = sortNodesTopologically([c2, c1, p1, p2])
    const ids = result.map((n) => n.id)
    expect(ids.indexOf("p1")).toBeLessThan(ids.indexOf("c1"))
    expect(ids.indexOf("p2")).toBeLessThan(ids.indexOf("c2"))
  })
})

// ---------------------------------------------------------------------------
// isParentNodeType
// ---------------------------------------------------------------------------

describe("isParentNodeType", () => {
  const parentTypes = [
    "package",
    "activity",
    "useCaseSystem",
    "componentSubsystem",
    "deploymentNode",
    "deploymentComponent",
    "bpmnPool",
    "bpmnGroup",
    "bpmnSubprocess",
    "bpmnTransaction",
  ]

  it.each(parentTypes)("returns true for %s", (type) => {
    expect(isParentNodeType(type)).toBe(true)
  })

  it("returns false for undefined", () => {
    expect(isParentNodeType(undefined)).toBe(false)
  })

  it("returns false for an empty string", () => {
    expect(isParentNodeType("")).toBe(false)
  })

  it("returns false for non-parent node types", () => {
    expect(isParentNodeType("class")).toBe(false)
    expect(isParentNodeType("bpmnTask")).toBe(false)
    expect(isParentNodeType("useCase")).toBe(false)
    expect(isParentNodeType("component")).toBe(false)
  })

  it("returns false for random string", () => {
    expect(isParentNodeType("nonExistentType")).toBe(false)
  })
})
