import { describe, it, expect } from "vitest"
import {
  convertV3ToV4,
  convertV4ToV3Agent,
  importDiagram,
} from "@/utils/versionConverter"
import type { V3DiagramFormat } from "@/utils/v3Typings"

/**
 * Stored v3 projects and bundled templates carry agentic BPMN, component /
 * deployment architecture and A2A agent fields. Each one must land on
 * `node.data` / `edge.data` under its v3 name when the model is loaded.
 */

const bounds = { x: 0, y: 0, width: 200, height: 100 }

function wrap(
  type: string,
  elements: Record<string, unknown>,
  relationships: Record<string, unknown> = {}
): V3DiagramFormat {
  return {
    id: "d1",
    title: "T",
    model: {
      version: "3.0.0",
      type,
      size: { width: 1200, height: 800 },
      interactive: { elements: {}, relationships: {} },
      elements,
      relationships,
      assessments: {},
    },
  } as unknown as V3DiagramFormat
}

function el(id: string, type: string, extra: Record<string, unknown> = {}) {
  return { id, name: id, type, owner: null, bounds, ...extra }
}

function rel(
  id: string,
  type: string,
  source: string,
  target: string,
  extra: Record<string, unknown> = {}
) {
  return {
    id,
    name: "",
    type,
    owner: null,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    path: [],
    source: { element: source, direction: "Right" },
    target: { element: target, direction: "Left" },
    ...extra,
  }
}

const nodeData = (model: { nodes: { id: string; data: unknown }[] }, id: string) =>
  model.nodes.find((n) => n.id === id)?.data as Record<string, unknown>

const edgeData = (model: { edges: { id: string; data?: unknown }[] }, id: string) =>
  model.edges.find((e) => e.id === id)?.data as Record<string, unknown>

describe("agentic BPMN fields survive v3 -> v4", () => {
  const v3 = wrap(
    "BPMN",
    {
      pool: el("pool", "BPMNPool", {
        bounds: { x: 0, y: 0, width: 1000, height: 600 },
      }),
      laneA: el("laneA", "BPMNSwimlane", {
        owner: "pool",
        bounds: { x: 30, y: 0, width: 970, height: 300 },
        isAgentic: true,
        role: "supervision",
        trustScore: 80,
        multiplicity: 3,
        agentDiagramRef: "agent-diagram-1",
      }),
      laneLegacy: el("laneLegacy", "BPMNSwimlane", {
        owner: "pool",
        bounds: { x: 30, y: 300, width: 970, height: 300 },
        isAgentic: true,
        role: "worker",
        trustScore: 50,
        multiplicity: 1,
        agentDiagramRef: null,
      }),
      task: el("task", "BPMNTask", {
        owner: "laneA",
        bounds: { x: 100, y: 50, width: 160, height: 80 },
        taskType: "default",
        marker: "none",
        isAgentic: true,
        reflectionMode: "cross",
        trustScore: 70,
        reflectionReviewerLaneId: "laneLegacy",
        agentDiagramRef: null,
      }),
      gw: el("gw", "BPMNGateway", {
        owner: "laneA",
        bounds: { x: 400, y: 60, width: 40, height: 40 },
        gatewayType: "parallel",
        isAgentic: true,
        gatewayRole: "merging",
        trustScore: 60,
        governanceDsl: "policy majority { threshold: 0.5 }",
      }),
      plainTask: el("plainTask", "BPMNTask", {
        owner: "laneLegacy",
        bounds: { x: 100, y: 350, width: 160, height: 80 },
        taskType: "user",
        marker: "loop",
      }),
    },
    {
      mf: rel("mf", "BPMNFlow", "task", "plainTask", {
        flowType: "message",
        isDefault: false,
        isAgentic: true,
        trustScore: 40,
      }),
      sf: rel("sf", "BPMNFlow", "task", "gw", {
        flowType: "sequence",
        isDefault: false,
      }),
    }
  )

  it("carries lane, task and gateway agentic fields", () => {
    const v4 = convertV3ToV4(v3)
    expect(nodeData(v4, "laneA")).toMatchObject({
      isAgentic: true,
      role: "supervision",
      trustScore: 80,
      multiplicity: 3,
      agentDiagramRef: "agent-diagram-1",
    })
    expect(nodeData(v4, "task")).toMatchObject({
      taskType: "default",
      marker: "none",
      isAgentic: true,
      reflectionMode: "cross",
      trustScore: 70,
      reflectionReviewerLaneId: "laneLegacy",
    })
    expect(nodeData(v4, "gw")).toMatchObject({
      gatewayType: "parallel",
      isAgentic: true,
      gatewayRole: "merging",
      trustScore: 60,
      governanceDsl: "policy majority { threshold: 0.5 }",
    })
  })

  it("keeps null refs as null and migrates legacy lane roles", () => {
    const v4 = convertV3ToV4(v3)
    const legacy = nodeData(v4, "laneLegacy")
    expect(legacy.role).toBe("solution")
    expect(legacy).toHaveProperty("agentDiagramRef", null)
    expect(nodeData(v4, "task")).toHaveProperty("agentDiagramRef", null)
  })

  it("adds no agentic keys to plain BPMN elements", () => {
    const data = nodeData(convertV3ToV4(v3), "plainTask")
    for (const key of [
      "isAgentic",
      "reflectionMode",
      "trustScore",
      "reflectionReviewerLaneId",
      "agentDiagramRef",
    ]) {
      expect(data).not.toHaveProperty(key)
    }
    expect(edgeData(convertV3ToV4(v3), "sf")).not.toHaveProperty("isAgentic")
  })

  it("carries agentic attributes on message flows", () => {
    expect(edgeData(convertV3ToV4(v3), "mf")).toMatchObject({
      flowType: "message",
      isAgentic: true,
      trustScore: 40,
    })
  })

  it("keeps the fields through importDiagram normalization", () => {
    const v4 = importDiagram(v3)
    expect(nodeData(v4, "laneA").multiplicity).toBe(3)
    expect(nodeData(v4, "task").reflectionMode).toBe("cross")
    expect(nodeData(v4, "gw").governanceDsl).toContain("majority")
  })
})

describe("component diagram fields survive v3 -> v4", () => {
  const v3 = wrap(
    "ComponentDiagram",
    {
      sub: el("sub", "Subsystem", {
        bounds: { x: 0, y: 0, width: 600, height: 400 },
        stereotype: "subsystem",
        displayStereotype: false,
      }),
      coder: el("coder", "Component", {
        owner: "sub",
        bounds: { x: 20, y: 40, width: 200, height: 100 },
        stereotype: "solution",
        displayStereotype: true,
        realizes: ["class-1"],
        processModelRefs: ["bpmn-1"],
        agentModelRef: "agent-diagram-1",
      }),
      reviewer: el("reviewer", "Component", {
        owner: "sub",
        bounds: { x: 300, y: 40, width: 200, height: 100 },
        stereotype: "supervision",
        displayStereotype: true,
        realizes: [],
        processModelRefs: [],
      }),
    },
    {
      dep: rel("dep", "ComponentDependency", "reviewer", "coder", {
        stereotype: "supervises",
      }),
    }
  )

  it("maps Subsystem with its stereotype and header flag", () => {
    const v4 = convertV3ToV4(v3)
    expect(v4.nodes.find((n) => n.id === "sub")?.type).toBe(
      "componentSubsystem"
    )
    expect(nodeData(v4, "sub")).toMatchObject({
      stereotype: "subsystem",
      isComponentSubsystemHeaderShown: false,
    })
  })

  it("carries component stereotype, realizes and model refs", () => {
    const v4 = convertV3ToV4(v3)
    expect(nodeData(v4, "coder")).toMatchObject({
      stereotype: "solution",
      isComponentHeaderShown: true,
      realizes: ["class-1"],
      processModelRefs: ["bpmn-1"],
      agentModelRef: "agent-diagram-1",
    })
    expect(nodeData(v4, "reviewer")).not.toHaveProperty("agentModelRef")
  })

  it("carries the ComponentDependency stereotype", () => {
    expect(edgeData(convertV3ToV4(v3), "dep").stereotype).toBe("supervises")
  })
})

describe("deployment diagram fields survive v3 -> v4", () => {
  const v3 = wrap(
    "DeploymentDiagram",
    {
      node: el("node", "DeploymentNode", {
        bounds: { x: 0, y: 0, width: 600, height: 400 },
        stereotype: "container",
        displayStereotype: true,
      }),
      comp: el("comp", "DeploymentComponent", {
        owner: "node",
        bounds: { x: 20, y: 40, width: 200, height: 100 },
        stereotype: "agent",
        displayStereotype: true,
      }),
      art: el("art", "DeploymentArtifact", {
        owner: "node",
        bounds: { x: 300, y: 40, width: 200, height: 40 },
        manifests: ["coder"],
        agentModelRef: "agent-diagram-1",
      }),
    },
    {
      assoc: rel("assoc", "DeploymentAssociation", "comp", "art", {
        name: "http",
        stereotype: "uses",
      }),
    }
  )

  it("carries component stereotype and artifact manifests / agentModelRef", () => {
    const v4 = convertV3ToV4(v3)
    expect(nodeData(v4, "node").stereotype).toBe("container")
    expect(nodeData(v4, "comp").stereotype).toBe("agent")
    expect(nodeData(v4, "art")).toMatchObject({
      manifests: ["coder"],
      agentModelRef: "agent-diagram-1",
    })
  })

  it("carries the DeploymentAssociation stereotype and name", () => {
    expect(edgeData(convertV3ToV4(v3), "assoc")).toMatchObject({
      stereotype: "uses",
      name: "http",
    })
  })
})

describe("A2A AgentState description", () => {
  const description =
    "a2a:out;peer=Reviewer;ref=fix;flow=f1\na2a:out;peer=Coder2;flow=f2"
  const v3 = wrap(
    "AgentDiagram",
    {
      s1: el("s1", "AgentState", {
        replyType: "text",
        description,
        bodies: [],
        fallbackBodies: [],
      }),
      s2: el("s2", "AgentState", {
        replyType: "text",
        bodies: [],
        fallbackBodies: [],
      }),
    },
    {
      t1: rel("t1", "AgentStateTransition", "s2", "s1", {
        name: "a2a:in;peer=Reviewer;ref=fix",
      }),
    }
  )

  it("carries description to v4 and back to v3", () => {
    const v4 = convertV3ToV4(v3)
    expect(nodeData(v4, "s1").description).toBe(description)
    expect(nodeData(v4, "s2")).not.toHaveProperty("description")

    const back = convertV4ToV3Agent(v4)
    expect(
      (back.elements.s1 as unknown as { description?: string }).description
    ).toBe(description)
    expect(back.elements.s2).not.toHaveProperty("description")
    expect(back.relationships.t1.name).toBe("a2a:in;peer=Reviewer;ref=fix")
  })
})
