import { describe, expect, it } from "vitest"
import {
  BPMN_FLOW_EDGE_TYPES,
  bpmnEdgeTypeToFlowType,
  bpmnFlowTypeToEdgeType,
  canSourceCarryDefault,
  getAllowedBpmnFlowTypes,
  getDefaultBpmnFlowType,
  isBpmnFlowEdge,
  validateAllBpmnFlows,
  validateBpmnFlow,
} from "../../lib/services/bpmnFlowValidation"
import type { BesserEdge, BesserNode, UMLModel } from "../../lib/typings"
import { UMLDiagramType } from "../../lib/types"

// v4 fixture helpers — the validator reads node `.id/.type/.data.gatewayType`
// and edge `.id/.type/.source/.target/.data.isDefault`. The BPMN flow
// flavour is carried by the edge `type` instead of develop's single
// `BPMNFlow` + `flowType`.
const node = (id: string, type: string, data: Record<string, unknown> = {}): BesserNode => ({
  id,
  type: type as BesserNode["type"],
  position: { x: 0, y: 0 },
  width: 100,
  height: 50,
  measured: { width: 100, height: 50 },
  data: { name: id, ...data },
})

const flow = (
  id: string,
  source: string,
  target: string,
  type: string,
  data: Record<string, unknown> = {}
): BesserEdge => ({
  id,
  type: type as BesserEdge["type"],
  source,
  target,
  sourceHandle: "",
  targetHandle: "",
  data: { name: "", label: "", points: [], ...data },
})

const byId = (nodes: BesserNode[]): Record<string, BesserNode> =>
  Object.fromEntries(nodes.map((n) => [n.id, n]))

const model = (nodes: BesserNode[], edges: BesserEdge[]): UMLModel => ({
  version: "4.0.0",
  id: "m",
  title: "BPMN",
  type: UMLDiagramType.BPMN,
  nodes,
  edges,
  assessments: {},
})

describe("flow type <-> edge type mapping", () => {
  it("round-trips every BPMN flow edge type", () => {
    for (const edgeType of BPMN_FLOW_EDGE_TYPES) {
      const flowType = bpmnEdgeTypeToFlowType(edgeType)
      expect(flowType).toBeDefined()
      expect(bpmnFlowTypeToEdgeType(flowType!)).toBe(edgeType)
    }
  })

  it("returns undefined for non-BPMN edge types", () => {
    expect(bpmnEdgeTypeToFlowType("ClassBidirectional")).toBeUndefined()
    expect(bpmnEdgeTypeToFlowType(undefined)).toBeUndefined()
    expect(isBpmnFlowEdge({ type: "ClassBidirectional" })).toBe(false)
    expect(isBpmnFlowEdge(undefined)).toBe(false)
    expect(isBpmnFlowEdge({ type: "BPMNMessageFlow" })).toBe(true)
  })
})

describe("getAllowedBpmnFlowTypes (bpmn-flow-semantics)", () => {
  it("allows sequence between flow nodes", () => {
    expect(getAllowedBpmnFlowTypes("bpmnTask", "bpmnGateway")).toContain("sequence")
  })

  it("allows data association between task and data object (either direction)", () => {
    expect(getAllowedBpmnFlowTypes("bpmnTask", "bpmnDataObject")).toContain("data association")
    expect(getAllowedBpmnFlowTypes("bpmnDataStore", "bpmnTask")).toContain("data association")
    expect(getAllowedBpmnFlowTypes("bpmnTask", "bpmnDataObject")).not.toContain("sequence")
  })

  it("allows association when an annotation or group is involved", () => {
    expect(getAllowedBpmnFlowTypes("bpmnAnnotation", "bpmnTask")).toContain("association")
    expect(getAllowedBpmnFlowTypes("bpmnTask", "bpmnGroup")).toContain("association")
  })

  it("allows message flows between message-eligible nodes and pools, but not gateways", () => {
    expect(getAllowedBpmnFlowTypes("bpmnTask", "bpmnTask")).toContain("message")
    expect(getAllowedBpmnFlowTypes("bpmnPool", "bpmnPool")).toContain("message")
    expect(getAllowedBpmnFlowTypes("bpmnGateway", "bpmnTask")).not.toContain("message")
  })

  it("returns nothing for an illegal pair", () => {
    expect(getAllowedBpmnFlowTypes("bpmnDataObject", "bpmnDataStore")).toEqual([])
  })
})

describe("getDefaultBpmnFlowType", () => {
  it("has deterministic priority: sequence > message > data association > association", () => {
    expect(getDefaultBpmnFlowType(["association", "sequence"])).toBe("sequence")
    expect(getDefaultBpmnFlowType(["message", "association"])).toBe("message")
    expect(getDefaultBpmnFlowType(["association", "data association"])).toBe("data association")
    expect(getDefaultBpmnFlowType(["association"])).toBe("association")
    expect(getDefaultBpmnFlowType([])).toBe("association")
  })
})

describe("canSourceCarryDefault (BPMN 2.0.2 § 8.3.13)", () => {
  it("accepts activities and exclusive/inclusive/complex gateways", () => {
    expect(canSourceCarryDefault(node("t1", "bpmnTask"))).toBe(true)
    expect(canSourceCarryDefault(node("s1", "bpmnSubprocess"))).toBe(true)
    expect(canSourceCarryDefault(node("x1", "bpmnTransaction"))).toBe(true)
    expect(canSourceCarryDefault(node("c1", "bpmnCallActivity"))).toBe(true)
    expect(canSourceCarryDefault(node("g1", "bpmnGateway", { gatewayType: "exclusive" }))).toBe(true)
    expect(canSourceCarryDefault(node("g2", "bpmnGateway", { gatewayType: "inclusive" }))).toBe(true)
    expect(canSourceCarryDefault(node("g3", "bpmnGateway", { gatewayType: "complex" }))).toBe(true)
  })

  it("treats a gateway without gatewayType as the exclusive default", () => {
    expect(canSourceCarryDefault(node("g1", "bpmnGateway"))).toBe(true)
  })

  it("rejects parallel/event-based gateways, events and undefined", () => {
    expect(canSourceCarryDefault(node("g1", "bpmnGateway", { gatewayType: "parallel" }))).toBe(false)
    expect(canSourceCarryDefault(node("g2", "bpmnGateway", { gatewayType: "event-based" }))).toBe(false)
    expect(canSourceCarryDefault(node("s1", "bpmnStartEvent"))).toBe(false)
    expect(canSourceCarryDefault(node("d1", "bpmnDataObject"))).toBe(false)
    expect(canSourceCarryDefault(undefined)).toBe(false)
  })

  it("accepts duck-typed sources", () => {
    expect(canSourceCarryDefault({ type: "bpmnTask" })).toBe(true)
    expect(canSourceCarryDefault({ type: "bpmnGateway", data: { gatewayType: "parallel" } })).toBe(false)
  })
})

describe("validateBpmnFlow", () => {
  it("returns no warnings for a legal sequence flow", () => {
    const nodes = byId([node("t1", "bpmnTask"), node("g1", "bpmnGateway", { gatewayType: "exclusive" })])
    expect(validateBpmnFlow(flow("f1", "t1", "g1", "BPMNSequenceFlow"), nodes)).toEqual([])
  })

  it("returns no warnings for a legal default flow", () => {
    const nodes = byId([node("g1", "bpmnGateway", { gatewayType: "exclusive" }), node("t1", "bpmnTask")])
    expect(validateBpmnFlow(flow("f1", "g1", "t1", "BPMNSequenceFlow", { isDefault: true }), nodes)).toEqual([])
  })

  it("ignores non-BPMN edge types", () => {
    const nodes = byId([node("t1", "bpmnTask"), node("t2", "bpmnTask")])
    expect(validateBpmnFlow(flow("f1", "t1", "t2", "ClassBidirectional"), nodes)).toEqual([])
  })

  it("flags an illegal flow type for the endpoint pair", () => {
    const nodes = byId([node("t1", "bpmnTask"), node("t2", "bpmnTask")])
    const warnings = validateBpmnFlow(flow("f1", "t1", "t2", "BPMNAssociationFlow"), nodes)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({
      code: "illegal-flow-type",
      flowId: "f1",
      sourceId: "t1",
      targetId: "t2",
    })
    expect(warnings[0].message).toContain('"association"')
    expect(warnings[0].message).toContain("allowed: sequence, message")
  })

  it("flags a default flag on an ineligible source", () => {
    const nodes = byId([node("g1", "bpmnGateway", { gatewayType: "parallel" }), node("t1", "bpmnTask")])
    const warnings = validateBpmnFlow(flow("f1", "g1", "t1", "BPMNSequenceFlow", { isDefault: true }), nodes)
    expect(warnings.map((w) => w.code)).toEqual(["default-flow-illegal-source"])
  })

  it("flags a default flag on a non-sequence flow", () => {
    const nodes = byId([node("t1", "bpmnTask"), node("t2", "bpmnTask")])
    const warnings = validateBpmnFlow(flow("f1", "t1", "t2", "BPMNMessageFlow", { isDefault: true }), nodes)
    expect(warnings.map((w) => w.code)).toEqual(["default-flow-illegal-source"])
  })

  it("flags a missing endpoint and stops there", () => {
    const warnings = validateBpmnFlow(
      flow("f1", "ghost", "t1", "BPMNSequenceFlow", { isDefault: true, name: "go" }),
      byId([node("t1", "bpmnTask")])
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({
      code: "missing-endpoint",
      flowId: "f1",
      flowName: "go",
      sourceId: "ghost",
      targetId: "t1",
    })
    expect(warnings[0].message).toContain("missing source")
  })

  it("omits flowName when the edge has no name or label", () => {
    const warnings = validateBpmnFlow(flow("f1", "t1", "t2", "BPMNAssociationFlow"), byId([node("t1", "bpmnTask"), node("t2", "bpmnTask")]))
    expect("flowName" in warnings[0]).toBe(false)
  })
})

describe("validateAllBpmnFlows", () => {
  it("collects warnings across every flow of a model", () => {
    const t1 = node("t1", "bpmnTask")
    const t2 = node("t2", "bpmnTask")
    const bad = flow("bad", "t1", "t2", "BPMNAssociationFlow")
    const good = flow("good", "t1", "t2", "BPMNSequenceFlow")
    const warnings = validateAllBpmnFlows(model([t1, t2], [bad, good]))
    expect(warnings).toHaveLength(1)
    expect(warnings[0].flowId).toBe("bad")
    expect(warnings[0].code).toBe("illegal-flow-type")
  })

  it("returns nothing for a model without edges", () => {
    expect(validateAllBpmnFlows(model([node("t1", "bpmnTask")], []))).toEqual([])
  })

  it("tolerates a model whose arrays are missing", () => {
    expect(validateAllBpmnFlows({ ...model([], []), nodes: undefined, edges: undefined } as unknown as UMLModel)).toEqual([])
  })
})
