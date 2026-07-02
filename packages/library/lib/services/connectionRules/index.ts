/**
 * Connection-rule seam. Importing this module registers every
 * diagram-scoped rule module (side-effect imports below) and re-exports
 * the registry API consumed by `canConnectEndpoints`
 * (`utils/bpmnConstraints.ts`).
 *
 * Adding rules for another diagram family = one new module + one
 * side-effect import here (`nnDiagramRules` is the worked example).
 */
import "./objectDiagramRules"
import "./nnDiagramRules"
import "./bpmnFlowRules"

export {
  registerConnectionRule,
  evaluateConnectionRules,
  type ConnectionRuleContext,
  type DiagramConnectionRule,
  type MinimalRuleNode,
  type MinimalRuleEdge,
} from "./registry"
export { objectLinkConnectionRule } from "./objectDiagramRules"
export { nnConnectionRule } from "./nnDiagramRules"
export { bpmnFlowConnectionRule } from "./bpmnFlowRules"
