/**
 * Agent reasoning-state fold + reasoning primitives —
 * AgentState(stateType:"reasoning") / AgentTool / AgentSkill /
 * AgentWorkspace.
 *
 * Develop folded the standalone `AgentReasoningState` element into
 * `AgentState` with `stateType: "reasoning"` (`agent-state.ts`). These
 * tests assert:
 *
 *  1. LEGACY FOLD: a pre-fold v3 `AgentReasoningState` element migrates
 *     into a v4 `AgentState` node with `stateType: "reasoning"` and the
 *     develop reasoning fields (backward-compat contract for old saves).
 *  2. v4 → v3 emits the reasoning state back as an `AgentState` element
 *     carrying `stateType: "reasoning"` + the reasoning fields (develop
 *     serialize()).
 *  3. AgentTool / AgentSkill / AgentWorkspace primitives round-trip.
 *  4. `normalizeV4Model` seeds missing defaults on the capability
 *     primitives.
 *  5. `resolveAgentEdgeType` treats an `AgentState` endpoint (which now
 *     covers reasoning) as a state-like endpoint (init edge promotion).
 *  6. The AgentDiagram palette carries the develop section layout —
 *     Flow / Knowledge / Capabilities — with the reasoning drag source
 *     folded into an `AgentState`-typed entry.
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
  AgentStateNodeProps,
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

/**
 * Minimal v3 AgentDiagram carrying one legacy `AgentReasoningState`
 * element plus one of each capability primitive.
 */
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

/* ─────────────────────── legacy fold (v3 → v4) ─────────────────────── */

describe("AgentReasoningState legacy fold + primitives v3 → v4", () => {
  const v4 = migrateAgentDiagramV3ToV4(reasoningV3)

  it("folds a legacy AgentReasoningState into an AgentState reasoning node", () => {
    const rs = v4.nodes.find((n) => n.id === "rs-1")!
    expect(rs).toBeDefined()
    // Legacy fold: no separate `AgentReasoningState` v4 node type.
    expect(rs.type).toBe("AgentState")
    const data = rs.data as AgentStateNodeProps
    expect(data.name).toBe("reason")
    expect(data.stateType).toBe("reasoning")
    expect(data.llm_name).toBe("gpt-4o-mini")
    expect(data.max_steps).toBe(15)
    expect(data.enable_task_planning).toBe(true)
    expect(data.stream_steps).toBe(false)
    expect(data.system_prompt).toBe("Be concise.")
    expect(data.fallback_message).toBe("Loop failed.")
    // No v4 node of the retired type survives.
    expect(v4.nodes.some((n) => (n.type as string) === "AgentReasoningState")).toBe(
      false
    )
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

  it("seeds develop reasoning defaults when a legacy state omits them", () => {
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
    expect(rs.type).toBe("AgentState")
    const rsData = rs.data as AgentStateNodeProps
    expect(rsData.stateType).toBe("reasoning")
    expect(rsData.llm_name).toBe("")
    expect(rsData.max_steps).toBe(8)
    expect(rsData.enable_task_planning).toBe(true)
    expect(rsData.stream_steps).toBe(true)
    expect(rsData.system_prompt).toBe("")
    expect(rsData.fallback_message).toBe("")
    const ws = out.nodes.find((n) => n.id === "ws-min")!
      .data as AgentWorkspaceNodeProps
    expect(ws.path).toBe("")
    expect(ws.writable).toBe(true)
    expect(ws.max_read_bytes).toBe(200000)
  })
})

/* ───────────────────────────── v4 → v3 ─────────────────────────────── */

describe("Reasoning state + primitives v4 → v3 inverse", () => {
  const v4 = migrateAgentDiagramV3ToV4(reasoningV3)
  const v3 = convertV4ToV3Agent(v4)

  it("re-emits the reasoning state as an AgentState + stateType wire form", () => {
    const rs = v3.elements["rs-1"] as Record<string, unknown>
    // No more separate `AgentReasoningState` wire type.
    expect(rs.type).toBe("AgentState")
    expect(rs.stateType).toBe("reasoning")
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

  it("v3 → v4 → v3 keeps the reasoning fields intact (minus the folded type/initial)", () => {
    const rs = v3.elements["rs-1"] as Record<string, unknown>
    // `initial` is no longer a data field on a reasoning state — it is
    // re-derived from the init edge, so it does not round-trip here.
    expect(rs.llm_name).toBe("gpt-4o-mini")
    expect(rs.max_steps).toBe(15)
    expect(rs.enable_task_planning).toBe(true)
    expect(rs.stream_steps).toBe(false)
    expect(rs.system_prompt).toBe("Be concise.")
    expect(rs.fallback_message).toBe("Loop failed.")
  })

  it("v3 → v4 → v3 keeps the capability-primitive fields intact", () => {
    const source = (reasoningV3 as { elements: Record<string, never> }).elements
    for (const id of ["tool-1", "skill-1", "ws-1"]) {
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

describe("normalizeV4Model — capability primitive defaults", () => {
  it("seeds develop defaults on partial v4 nodes", () => {
    const model = {
      version: "4.0.0",
      type: "AgentDiagram",
      nodes: [
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

describe("resolveAgentEdgeType — AgentState (covers reasoning)", () => {
  it("initial → AgentState promotes to AgentStateTransitionInit", () => {
    expect(
      resolveAgentEdgeType(
        "StateInitialNode",
        "AgentState",
        "AgentStateTransition"
      )
    ).toBe("AgentStateTransitionInit")
  })

  it("AgentState → initial promotes to AgentStateTransitionInit", () => {
    expect(
      resolveAgentEdgeType(
        "AgentState",
        "StateInitialNode",
        "AgentStateTransition"
      )
    ).toBe("AgentStateTransitionInit")
  })

  it("AgentState ↔ AgentState falls back to the default transition", () => {
    expect(
      resolveAgentEdgeType(
        "AgentState",
        "AgentState",
        "AgentStateTransition"
      )
    ).toBe("AgentStateTransition")
  })

  it("tool / skill / workspace endpoints keep the fallback", () => {
    for (const t of ["AgentTool", "AgentSkill", "AgentWorkspace"]) {
      expect(
        resolveAgentEdgeType(t, "AgentState", "AgentStateTransition")
      ).toBe("AgentStateTransition")
    }
  })
})

/* ───────────────────────────── palette layout ──────────────────────── */

describe("AgentDiagram palette — develop section layout", () => {
  const palette = dropElementConfigs[UMLDiagramType.AgentDiagram]

  it("carries the three titled sections in develop order", () => {
    const labels = palette
      .map((entry) => entry.sectionLabel)
      .filter((label): label is string => !!label)
    expect(labels).toEqual(["Flow", "Knowledge", "Capabilities"])
  })

  it("offers a drag source for each capability primitive + a reasoning AgentState", () => {
    const types = palette.map((entry) => entry.type as string)
    expect(types).toContain("AgentState")
    expect(types).toContain("AgentTool")
    expect(types).toContain("AgentSkill")
    expect(types).toContain("AgentWorkspace")
    // No standalone AgentReasoningState palette type after the fold.
    expect(types).not.toContain("AgentReasoningState")
    // The reasoning shortcut is an AgentState-typed entry.
    const reasoning = palette.find(
      (e) =>
        (e.type as string) === "AgentState" &&
        (e.defaultData as { stateType?: string })?.stateType === "reasoning"
    )
    expect(reasoning).toBeDefined()
  })

  it("reasoning drag source ships the develop element defaults on AgentState", () => {
    const entry = palette.find(
      (e) =>
        (e.type as string) === "AgentState" &&
        (e.defaultData as { stateType?: string })?.stateType === "reasoning"
    )!
    expect(entry.defaultData).toMatchObject({
      name: "ReasoningState",
      stateType: "reasoning",
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
