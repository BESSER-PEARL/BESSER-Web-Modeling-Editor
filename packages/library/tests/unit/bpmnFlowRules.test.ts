/**
 * BPMN flow-legality connection tests.
 *
 * v3 source of truth: `bpmn/bpmn-flow/bpmn-flow-validator.ts`
 * (`illegal-flow-type`) + `bpmn-flow-semantics.ts`
 * (`getAllowedBpmnFlowTypes`). Develop surfaces an illegal flow as a
 * post-hoc validation warning; the v4 port
 * (`services/connectionRules/bpmnFlowRules.ts`) enforces the same
 * legality up-front as an `isValidConnection` rejection, the same pattern
 * `nnDiagramRules.ts` uses for NN.
 *
 * The rule is scoped by node type (both endpoints must be `bpmn*`), so no
 * React Flow / zustand is needed — it is exercised as a pure predicate.
 */
import { describe, it, expect } from "vitest"
import { bpmnFlowConnectionRule } from "@/services/connectionRules"
import { canConnectEndpoints } from "@/utils/bpmnConstraints"
import type { MinimalRuleNode } from "@/services/connectionRules"

const node = (id: string, type: string): MinimalRuleNode => ({
  id,
  type,
  data: { name: id },
})

const NODES: MinimalRuleNode[] = [
  node("task-1", "bpmnTask"),
  node("task-2", "bpmnTask"),
  node("pool-1", "bpmnPool"),
  node("pool-2", "bpmnPool"),
  node("data-1", "bpmnDataObject"),
  node("data-2", "bpmnDataStore"),
  node("ann-1", "bpmnAnnotation"),
  node("class-1", "class"),
  node("class-2", "class"),
]

const byId = (id: string) => NODES.find((n) => n.id === id)

const verdict = (sourceId: string, targetId: string) =>
  bpmnFlowConnectionRule({
    nodes: NODES,
    sourceNode: byId(sourceId),
    targetNode: byId(targetId),
  })

describe("bpmnFlowConnectionRule — legality", () => {
  it("has no opinion on a legal task → task pair (sequence flow)", () => {
    expect(verdict("task-1", "task-2")).toBeUndefined()
  })

  it("has no opinion on a legal pool → pool pair (message flow)", () => {
    expect(verdict("pool-1", "pool-2")).toBeUndefined()
  })

  it("has no opinion on a legal dataObject → task pair (data association)", () => {
    expect(verdict("data-1", "task-1")).toBeUndefined()
  })

  it("has no opinion on a legal annotation → task pair (association)", () => {
    expect(verdict("ann-1", "task-1")).toBeUndefined()
  })

  it("vetoes an illegal dataObject → dataStore pair (no legal subtype)", () => {
    expect(verdict("data-1", "data-2")).toBe(false)
  })

  it("has no opinion when either endpoint is not a bpmn node", () => {
    expect(verdict("class-1", "class-2")).toBeUndefined()
    expect(verdict("task-1", "class-1")).toBeUndefined()
    expect(verdict("class-1", "task-1")).toBeUndefined()
  })
})

describe("canConnectEndpoints — BPMN rules ride the shared pipeline", () => {
  it("allows a legal task → task drag end-to-end", () => {
    expect(canConnectEndpoints(NODES, "task-1", "task-2")).toBe(true)
  })

  it("vetoes an illegal data-node ↔ data-node drag end-to-end", () => {
    expect(canConnectEndpoints(NODES, "data-1", "data-2")).toBe(false)
  })

  it("leaves non-BPMN pairs unaffected", () => {
    expect(canConnectEndpoints(NODES, "class-1", "class-2")).toBe(true)
  })
})
