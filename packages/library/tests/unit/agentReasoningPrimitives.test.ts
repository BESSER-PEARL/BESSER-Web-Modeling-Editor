/**
 * Wave-2 reasoning primitives — AgentReasoningState / AgentTool /
 * AgentSkill / AgentWorkspace.
 *
 * Asserts (develop parity, `agent-state-diagram` package):
 *
 *  1. v3 → v4 migration maps each primitive to its v4 node with the
 *     develop deserialize defaults applied.
 *  2. v4 → v3 inverse emits the develop serialize() wire form (every
 *     field present, defaults applied).
 *  3. v3 → v4 → v3 keeps the primitive fields intact.
 *  4. `normalizeV4Model` seeds missing defaults on partial v4 nodes
 *     (templates / hand-written fixtures).
 *  5. `resolveAgentEdgeType` treats AgentReasoningState as a
 *     state-like endpoint (init edge promotion).
 *  6. The AgentDiagram palette carries the develop section layout —
 *     Flow / Reasoning / Knowledge / Capabilities — and the new
 *     drag sources.
 */
import { describe, it, expect } from "vitest"
import {
  convertV3ToV4,
  convertV4ToV3Agent,
  migrateAgentDiagramV3ToV4,
  normalizeV4Model,
} from "@/utils/versionConverter"
import { resolveAgentEdgeType } from "@/utils/edgeUtils"
import { dropElementConfigs } from "@/constants"
import { UMLDiagramType } from "@/types"
import type {
  AgentReasoningStateNodeProps,
  AgentSkillNodeProps,
  AgentToolNodeProps,
  AgentWorkspaceNodeProps,
  UMLModel,
} from "@/types"

/* ────────────────────────────── fixtures ───────────────────────────── */

const bounds = (x: number, y: number, w = 160, h = 80) => ({
  x,
  y,
  width: w,
  height: h,
})

/** Minimal v3 AgentDiagram with one of each reasoning primitive. */
const reasoningV3 = {
  version: "3.0.0",
  type: "AgentDiagram",
  size: { width: 1400, height: 740 },
  interactive: { elements: {}, relationships: {} },
  elements: {
    "rs-1": {
      id: "rs-1",
      name: "reason",
      type: "AgentReasoningState",
      owner: null,
      bounds: bounds(0, 0, 200, 80),
      initial: true,
      llm_name: "gpt-4o-mini",
      max_steps: 15,
      enable_task_planning: true,
      stream_steps: false,
      system_prompt: "Be concise.",
      fallback_message: "Loop failed.",
    },
    "tool-1": {
      id: "tool-1",
      name: "ping",
      type: "AgentTool",
      owner: null,
      bounds: bounds(0, 200),
      description: "Ping the server.",
      code: "def ping():\n    return 'pong'\n",
    },
    "skill-1": {
      id: "skill-1",
      name: "GreetByName",
      type: "AgentSkill",
      owner: null,
      bounds: bounds(200, 200),
      content: "Always greet the user by name.",
      description: "Greeting playbook.",
    },
    "ws-1": {
      id: "ws-1",
      name: "cinema",
      type: "AgentWorkspace",
      owner: null,
      bounds: bounds(400, 200),
      path: "/tmp/cinema",
      description: "Cinema files.",
      writable: false,
      max_read_bytes: 50000,
    },
  },
  relationships: {},
  assessments: {},
} as never

/* ───────────────────────────── v3 → v4 ─────────────────────────────── */

describe("AgentDiagram reasoning primitives v3 → v4", () => {
  const v4 = migrateAgentDiagramV3ToV4(reasoningV3)

  it("migrates AgentReasoningState with every develop field", () => {
    const rs = v4.nodes.find((n) => n.id === "rs-1")!
    expect(rs).toBeDefined()
    expect(rs.type).toBe("AgentReasoningState")
    const data = rs.data as AgentReasoningStateNodeProps
    expect(data.name).toBe("reason")
    expect(data.initial).toBe(true)
    expect(data.llm_name).toBe("gpt-4o-mini")
    expect(data.max_steps).toBe(15)
    expect(data.enable_task_planning).toBe(true)
    expect(data.stream_steps).toBe(false)
    expect(data.system_prompt).toBe("Be concise.")
    expect(data.fallback_message).toBe("Loop failed.")
  })

  it("migrates AgentTool with description + code", () => {
    const tool = v4.nodes.find((n) => n.id === "tool-1")!
    expect(tool.type).toBe("AgentTool")
    const data = tool.data as AgentToolNodeProps
    expect(data.name).toBe("ping")
    expect(data.description).toBe("Ping the server.")
    expect(data.code).toContain("def ping")
  })

  it("migrates AgentSkill with content + description", () => {
    const skill = v4.nodes.find((n) => n.id === "skill-1")!
    expect(skill.type).toBe("AgentSkill")
    const data = skill.data as AgentSkillNodeProps
    expect(data.name).toBe("GreetByName")
    expect(data.content).toBe("Always greet the user by name.")
    expect(data.description).toBe("Greeting playbook.")
  })

  it("migrates AgentWorkspace with path / writable / max_read_bytes", () => {
    const ws = v4.nodes.find((n) => n.id === "ws-1")!
    expect(ws.type).toBe("AgentWorkspace")
    const data = ws.data as AgentWorkspaceNodeProps
    expect(data.name).toBe("cinema")
    expect(data.path).toBe("/tmp/cinema")
    expect(data.description).toBe("Cinema files.")
    expect(data.writable).toBe(false)
    expect(data.max_read_bytes).toBe(50000)
  })

  it("applies develop deserialize defaults when v3 fields are absent", () => {
    const sparse = {
      version: "3.0.0",
      type: "AgentDiagram",
      size: { width: 100, height: 100 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        "rs-min": {
          id: "rs-min",
          name: "minimal",
          type: "AgentReasoningState",
          owner: null,
          bounds: bounds(0, 0, 200, 80),
        },
        "ws-min": {
          id: "ws-min",
          name: "wsmin",
          type: "AgentWorkspace",
          owner: null,
          bounds: bounds(0, 100),
        },
      },
      relationships: {},
      assessments: {},
    } as never
    const out = convertV3ToV4(sparse)
    const rs = out.nodes.find((n) => n.id === "rs-min")!
      .data as AgentReasoningStateNodeProps
    expect(rs.initial).toBe(false)
    expect(rs.llm_name).toBe("")
    expect(rs.max_steps).toBe(8)
    expect(rs.enable_task_planning).toBe(true)
    expect(rs.stream_steps).toBe(true)
    expect(rs.system_prompt).toBe("")
    expect(rs.fallback_message).toBe("")
    const ws = out.nodes.find((n) => n.id === "ws-min")!
      .data as AgentWorkspaceNodeProps
    expect(ws.path).toBe("")
    expect(ws.writable).toBe(true)
    expect(ws.max_read_bytes).toBe(200000)
  })
})

/* ───────────────────────────── v4 → v3 ─────────────────────────────── */

describe("AgentDiagram reasoning primitives v4 → v3 inverse", () => {
  const v4 = migrateAgentDiagramV3ToV4(reasoningV3)
  const v3 = convertV4ToV3Agent(v4)

  it("re-emits AgentReasoningState fields on the v3 wire form", () => {
    const rs = v3.elements["rs-1"] as Record<string, unknown>
    expect(rs.type).toBe("AgentReasoningState")
    expect(rs.initial).toBe(true)
    expect(rs.llm_name).toBe("gpt-4o-mini")
    expect(rs.max_steps).toBe(15)
    expect(rs.enable_task_planning).toBe(true)
    expect(rs.stream_steps).toBe(false)
    expect(rs.system_prompt).toBe("Be concise.")
    expect(rs.fallback_message).toBe("Loop failed.")
  })

  it("re-emits AgentTool / AgentSkill / AgentWorkspace fields", () => {
    const tool = v3.elements["tool-1"] as Record<string, unknown>
    expect(tool.description).toBe("Ping the server.")
    expect(tool.code).toContain("def ping")
    const skill = v3.elements["skill-1"] as Record<string, unknown>
    expect(skill.content).toBe("Always greet the user by name.")
    expect(skill.description).toBe("Greeting playbook.")
    const ws = v3.elements["ws-1"] as Record<string, unknown>
    expect(ws.path).toBe("/tmp/cinema")
    expect(ws.writable).toBe(false)
    expect(ws.max_read_bytes).toBe(50000)
  })

  it("v3 → v4 → v3 keeps the primitive fields intact", () => {
    const source = (reasoningV3 as { elements: Record<string, never> })
      .elements
    for (const id of ["rs-1", "tool-1", "skill-1", "ws-1"]) {
      const before = source[id] as Record<string, unknown>
      const after = v3.elements[id] as Record<string, unknown>
      for (const key of Object.keys(before)) {
        if (key === "bounds" || key === "owner") continue
        expect(after[key], `${id}.${key}`).toEqual(before[key])
      }
    }
  })
})

/* ─────────────────────────── normalizeV4Model ──────────────────────── */

describe("normalizeV4Model — reasoning primitive defaults", () => {
  it("seeds develop defaults on partial v4 nodes", () => {
    const model = {
      version: "4.0.0",
      type: "AgentDiagram",
      nodes: [
        {
          id: "rs-1",
          type: "AgentReasoningState",
          position: { x: 0, y: 0 },
          width: 200,
          height: 80,
          measured: { width: 200, height: 80 },
          data: { name: "reason" },
        },
        {
          id: "tool-1",
          type: "AgentTool",
          position: { x: 0, y: 100 },
          width: 160,
          height: 80,
          measured: { width: 160, height: 80 },
          data: { name: "ping", description: "kept" },
        },
        {
          id: "ws-1",
          type: "AgentWorkspace",
          position: { x: 0, y: 200 },
          width: 160,
          height: 80,
          measured: { width: 160, height: 80 },
          data: { name: "cinema", writable: false },
        },
      ],
      edges: [],
      assessments: {},
    } as unknown as UMLModel

    const out = normalizeV4Model(model)
    const rs = out.nodes.find((n) => n.id === "rs-1")!
      .data as AgentReasoningStateNodeProps
    expect(rs.max_steps).toBe(8)
    expect(rs.enable_task_planning).toBe(true)
    expect(rs.stream_steps).toBe(true)
    expect(rs.llm_name).toBe("")
    expect(rs.initial).toBe(false)
    const tool = out.nodes.find((n) => n.id === "tool-1")!
      .data as AgentToolNodeProps
    expect(tool.description).toBe("kept") // explicit value untouched
    expect(tool.code).toBe("")
    const ws = out.nodes.find((n) => n.id === "ws-1")!
      .data as AgentWorkspaceNodeProps
    expect(ws.writable).toBe(false) // explicit value untouched
    expect(ws.max_read_bytes).toBe(200000)
    expect(ws.path).toBe("")
  })

  it("leaves fully-specified nodes untouched (reference-equal)", () => {
    const node = {
      id: "skill-1",
      type: "AgentSkill",
      position: { x: 0, y: 0 },
      width: 160,
      height: 80,
      measured: { width: 160, height: 80 },
      data: { name: "s", content: "c", description: "d" },
    }
    const model = {
      version: "4.0.0",
      type: "AgentDiagram",
      nodes: [node],
      edges: [],
      assessments: {},
    } as unknown as UMLModel
    const out = normalizeV4Model(model)
    expect(out.nodes[0]).toBe(node)
  })
})

/* ─────────────────────────── resolveAgentEdgeType ──────────────────── */

describe("resolveAgentEdgeType — reasoning states", () => {
  it("initial → AgentReasoningState promotes to AgentStateTransitionInit", () => {
    expect(
      resolveAgentEdgeType(
        "StateInitialNode",
        "AgentReasoningState",
        "AgentStateTransition"
      )
    ).toBe("AgentStateTransitionInit")
  })

  it("AgentReasoningState → initial promotes to AgentStateTransitionInit", () => {
    expect(
      resolveAgentEdgeType(
        "AgentReasoningState",
        "StateInitialNode",
        "AgentStateTransition"
      )
    ).toBe("AgentStateTransitionInit")
  })

  it("AgentReasoningState ↔ AgentState falls back to the default transition", () => {
    expect(
      resolveAgentEdgeType(
        "AgentReasoningState",
        "AgentState",
        "AgentStateTransition"
      )
    ).toBe("AgentStateTransition")
    expect(
      resolveAgentEdgeType(
        "AgentState",
        "AgentReasoningState",
        "AgentStateTransition"
      )
    ).toBe("AgentStateTransition")
  })

  it("tool / skill / workspace endpoints keep the fallback", () => {
    for (const t of ["AgentTool", "AgentSkill", "AgentWorkspace"]) {
      expect(
        resolveAgentEdgeType(t, "AgentReasoningState", "AgentStateTransition")
      ).toBe("AgentStateTransition")
    }
  })
})

/* ───────────────────────────── palette layout ──────────────────────── */

describe("AgentDiagram palette — develop section layout", () => {
  const palette = dropElementConfigs[UMLDiagramType.AgentDiagram]

  it("carries the four titled sections in develop order", () => {
    const labels = palette
      .map((entry) => entry.sectionLabel)
      .filter((label): label is string => !!label)
    expect(labels).toEqual(["Flow", "Reasoning", "Knowledge", "Capabilities"])
  })

  it("offers a drag source for each reasoning primitive", () => {
    const types = palette.map((entry) => entry.type as string)
    expect(types).toContain("AgentReasoningState")
    expect(types).toContain("AgentTool")
    expect(types).toContain("AgentSkill")
    expect(types).toContain("AgentWorkspace")
  })

  it("ReasoningState drag source ships the develop element defaults", () => {
    const entry = palette.find(
      (e) => (e.type as string) === "AgentReasoningState"
    )!
    expect(entry.defaultData).toMatchObject({
      name: "ReasoningState",
      llm_name: "",
      max_steps: 8,
      enable_task_planning: true,
      stream_steps: true,
    })
  })

  it("tool / skill / workspace drag sources mirror the develop previews", () => {
    const tool = palette.find((e) => (e.type as string) === "AgentTool")!
    expect(tool.defaultData).toMatchObject({
      name: "tool_name",
      description: "What this tool does",
    })
    const skill = palette.find((e) => (e.type as string) === "AgentSkill")!
    expect(skill.defaultData).toMatchObject({
      name: "skill_name",
      description: "What this skill teaches",
    })
    const ws = palette.find((e) => (e.type as string) === "AgentWorkspace")!
    expect(ws.defaultData).toMatchObject({
      name: "workspace_name",
      path: "/path/to/dir",
      writable: true,
      max_read_bytes: 200000,
    })
  })
})
