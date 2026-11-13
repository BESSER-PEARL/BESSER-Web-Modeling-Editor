/**
 * NNDiagram connection rules — up-front `isValidConnection` parity for
 * develop's post-hoc deletions in
 * `v3 source: nn-diagram/nn-association/nn-association-monitor.tsx`:
 *
 *  - `checkAndUpdateAssociations` (122-159) auto-deleted any `NNNext`
 *    touching NNContainer / Configuration / Datasets, and any
 *    `NNAssociation` that wasn't Dataset ↔ NNContainer,
 *  - `enforceConfigurationSingleton` (46-65) deleted a second
 *    Configuration bound to the same container.
 *
 * Expressed here as connection *rejection* (React Flow's invalid-drag
 * cursor) instead of develop's create-then-delete monitor.
 *
 * Allow matrix (endpoint order irrelevant):
 *
 *  | pair                       | verdict                              |
 *  |----------------------------|--------------------------------------|
 *  | Configuration ↔ NNContainer| allow unless it breaks the singleton |
 *  | Dataset ↔ NNContainer      | allow (→ NNAssociation)              |
 *  | NNContainer ↔ NNContainer  | allow (→ NNComposition)              |
 *  | comment ↔ anything         | no opinion (→ CommentLink)           |
 *  | anything else touching container/config/dataset | reject          |
 *  | neither endpoint special   | no opinion (flow ↔ flow → NNNext)    |
 *
 * Singleton: at most ONE Configuration bound per NNContainer via an
 * `NNComposition` edge, and one container per Configuration —
 * develop's `enforceConfigurationSingleton`, keyed on the v4 edge
 * binding instead of develop's owner-nesting (v4 Configurations never
 * nest inside containers — see `NN_LAYER_KINDS_IN_CONTAINER` in
 * `utils/bpmnConstraints.ts`).
 *
 * Scoped by node type: NNContainer / Configuration / TrainingDataset /
 * TestDataset only exist on NN diagrams, so other diagram families are
 * never affected and no diagram-type threading is needed.
 */
import {
  registerConnectionRule,
  type DiagramConnectionRule,
  type MinimalRuleNode,
} from "./registry"

const isDataset = (t?: string): boolean =>
  t === "TrainingDataset" || t === "TestDataset"
const isConfig = (t?: string): boolean => t === "Configuration"
const isContainer = (t?: string): boolean => t === "NNContainer"
const isSpecial = (t?: string): boolean =>
  isDataset(t) || isConfig(t) || isContainer(t)

/**
 * The NN endpoint rule. Exported for direct unit testing; registered
 * once below.
 */
export const nnConnectionRule: DiagramConnectionRule = ({
  nodes,
  sourceNode,
  targetNode,
  edges,
}) => {
  const sourceType = sourceNode?.type
  const targetType = targetNode?.type

  // Comment tethering stays available on NN diagrams (develop's
  // monitor only deleted NNNext / NNAssociation edge types; comment
  // Links survived).
  if (sourceType === "comment" || targetType === "comment") return undefined

  // Neither endpoint is an NN special node → flow ↔ flow (NNNext) or a
  // different diagram family entirely. No opinion.
  if (!isSpecial(sourceType) && !isSpecial(targetType)) return undefined

  // Dataset ↔ NNContainer → NNAssociation.
  if (
    (isDataset(sourceType) && isContainer(targetType)) ||
    (isDataset(targetType) && isContainer(sourceType))
  ) {
    return true
  }

  // NNContainer ↔ NNContainer → NNComposition (sub-network reuse).
  if (isContainer(sourceType) && isContainer(targetType)) return true

  // Configuration ↔ NNContainer → NNComposition, singleton-guarded.
  if (
    (isConfig(sourceType) && isContainer(targetType)) ||
    (isConfig(targetType) && isContainer(sourceType))
  ) {
    const configId = isConfig(sourceType) ? sourceNode?.id : targetNode?.id
    const containerId = isConfig(sourceType) ? targetNode?.id : sourceNode?.id
    return !violatesConfigurationSingleton(
      nodes,
      edges ?? [],
      configId,
      containerId
    )
  }

  // Everything else touching container / config / dataset — develop's
  // monitor deleted exactly these (Dataset→layer, Configuration→layer,
  // container→layer, dataset↔dataset, config↔config, dataset↔config).
  return false
}

/**
 * True when binding `configId` to `containerId` would give the
 * container a second Configuration, or the Configuration a second
 * container, through `NNComposition` edges (either endpoint order).
 */
function violatesConfigurationSingleton(
  nodes: readonly MinimalRuleNode[],
  edges: readonly { type?: string; source: string; target: string }[],
  configId: string | undefined,
  containerId: string | undefined
): boolean {
  if (!configId || !containerId) return false
  const typeById = new Map<string, string | undefined>()
  for (const n of nodes) {
    if (n.id !== undefined) typeById.set(n.id, n.type)
  }
  for (const edge of edges) {
    if (edge.type !== "NNComposition") continue
    if (edge.source === containerId || edge.target === containerId) {
      const otherEnd: string =
        edge.source === containerId ? edge.target : edge.source
      if (otherEnd !== configId && isConfig(typeById.get(otherEnd))) {
        return true
      }
    }
    if (edge.source === configId || edge.target === configId) {
      const otherEnd: string =
        edge.source === configId ? edge.target : edge.source
      if (otherEnd !== containerId && isContainer(typeById.get(otherEnd))) {
        return true
      }
    }
  }
  return false
}

registerConnectionRule(nnConnectionRule)
