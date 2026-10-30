/**
 * StateMachineDiagram connection rules, matching what the backend makes of a
 * transition (`json_to_buml/state_machine_processor.py`): code blocks are
 * referenced by name (state bodies, events, guards) and a transition touching
 * one is dropped; the final node only ends the machine and the initial node
 * only starts it. Refused up-front instead of being lost on export.
 *
 * Comment tethering stays free, and an AgentState may still join the initial
 * node (the agent diagram's `AgentStateTransitionInit`).
 */
import { registerConnectionRule, type DiagramConnectionRule } from "./registry"

const FREE_ENDPOINTS: ReadonlySet<string> = new Set(["comment"])

export const stateMachineConnectionRule: DiagramConnectionRule = ({
  sourceNode,
  targetNode,
}) => {
  const s = sourceNode?.type ?? ""
  const t = targetNode?.type ?? ""
  if (FREE_ENDPOINTS.has(s) || FREE_ENDPOINTS.has(t)) return undefined
  if (s === "StateCodeBlock" || t === "StateCodeBlock") return false
  if (s === "StateFinalNode") return false
  if (t === "StateInitialNode" && s !== "AgentState") return false
  return undefined
}

registerConnectionRule(stateMachineConnectionRule)
