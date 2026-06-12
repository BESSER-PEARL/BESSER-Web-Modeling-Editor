/**
 * Diagram-scoped connection-rule registry.
 *
 * `isValidConnection` (via the shared `canConnectEndpoints` predicate in
 * `utils/bpmnConstraints.ts`) consults this registry after its built-in
 * checks. Each diagram family contributes its own rule module
 * (`objectDiagramRules.ts` here; NN rules plug into the same seam) so
 * the shared validator stays a thin pipeline instead of accreting
 * per-diagram conditionals.
 *
 * Rules are pure predicates over the minimal node shape:
 *  - return `false`  → veto the connection,
 *  - return `true` / `undefined` → no objection (next rule runs).
 *
 * This module is intentionally dependency-free so pure-helper tests can
 * import the registry without dragging React Flow / zustand into the
 * test graph (same constraint documented on `bpmnConstraints.ts`).
 */

/**
 * Minimal node shape rules can rely on (mirrors `MinimalNodeForConnect`).
 * `data` is deliberately `unknown` — each rule narrows the payload it
 * cares about, so any caller's node shape is accepted without casts.
 */
export interface MinimalRuleNode {
  id?: string
  type?: string
  data?: unknown
}

/**
 * Minimal edge shape rules can rely on. Optional in the context so
 * callers without an edge list (and legacy tests) keep working; rules
 * that need topology (e.g. the NN Configuration singleton) treat a
 * missing list as "no existing edges".
 */
export interface MinimalRuleEdge {
  id?: string
  type?: string
  source: string
  target: string
}

export type ConnectionRuleContext = {
  nodes: readonly MinimalRuleNode[]
  sourceNode: MinimalRuleNode | undefined
  targetNode: MinimalRuleNode | undefined
  edges?: readonly MinimalRuleEdge[]
}

/**
 * A single diagram-scoped rule. Return `false` to veto; anything else
 * means "no opinion".
 */
export type DiagramConnectionRule = (
  ctx: ConnectionRuleContext
) => boolean | undefined

const rules: DiagramConnectionRule[] = []

/**
 * Register a diagram-scoped rule. Returns an unregister function
 * (used by tests to restore a pristine registry).
 */
export function registerConnectionRule(
  rule: DiagramConnectionRule
): () => void {
  rules.push(rule)
  return () => {
    const idx = rules.indexOf(rule)
    if (idx >= 0) rules.splice(idx, 1)
  }
}

/**
 * Run every registered rule; the connection is allowed only when no
 * rule vetoes it.
 */
export function evaluateConnectionRules(ctx: ConnectionRuleContext): boolean {
  for (const rule of rules) {
    if (rule(ctx) === false) return false
  }
  return true
}
