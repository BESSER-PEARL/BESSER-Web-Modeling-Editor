/**
 * ObjectDiagram connection rules — v3 `canElementConnect` parity
 * (`v3 source: components/uml-element/connectable/connectable.tsx`).
 *
 * v3 suppressed the connect-target highlight (and thereby the
 * connection) when the hovered element was a **class-linked object
 * instance** whose class shares no association with the dragged-from
 * instance's class:
 *
 *   - target has `classId`:
 *       · source has no `classId`            → reject,
 *       · `getAvailableAssociations(targetClassId, sourceClassId)`
 *         empty                              → reject,
 *       · otherwise                          → allow.
 *   - target has no `classId` (unlinked instance, comment, …) → allow.
 *
 * `getAvailableAssociations` already folds both inheritance
 * hierarchies, so an association declared on a parent class allows
 * connecting instances of its subclasses (v3 behaviour).
 *
 * Scoped to `objectName` endpoints: only ObjectDiagram instances carry
 * this rule. Other classId-bearing nodes (StateObjectNode,
 * UserModelName) link classes for different semantics and are not
 * association-constrained here.
 */
import { diagramBridge } from "@/services/diagramBridge"
import {
  registerConnectionRule,
  type DiagramConnectionRule,
  type MinimalRuleNode,
} from "./registry"

const getClassId = (node: MinimalRuleNode | undefined): string | undefined => {
  const data = node?.data as { classId?: unknown } | null | undefined
  const raw = data?.classId
  return typeof raw === "string" && raw.length > 0 ? raw : undefined
}

/**
 * The object-link rule. Exported for direct unit testing; registered
 * once below.
 */
export const objectLinkConnectionRule: DiagramConnectionRule = ({
  sourceNode,
  targetNode,
}) => {
  // Only object-instance targets participate (v3 keyed the check off
  // the hovered element's classId; v4 additionally scopes by type so
  // other classId-bearing node families stay unaffected).
  if (targetNode?.type !== "objectName") return undefined

  const targetClassId = getClassId(targetNode)
  if (!targetClassId) return undefined

  const sourceClassId = getClassId(sourceNode)
  if (!sourceClassId) return false

  try {
    return (
      diagramBridge.getAvailableAssociations(targetClassId, sourceClassId)
        .length > 0
    )
  } catch {
    // Malformed bridge data must not lock the canvas — fall back to
    // allowing the connection (matching the bridge's own error
    // tolerance, which returns [] only on *valid* empty data).
    return undefined
  }
}

registerConnectionRule(objectLinkConnectionRule)
