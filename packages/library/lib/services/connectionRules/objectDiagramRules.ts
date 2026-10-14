/**
 * ObjectDiagram / UserDiagram connection rules — v3 `canElementConnect`
 * parity (`v3 source: components/uml-element/connectable/
 * connectable.tsx:523-568`).
 *
 * v3 suppressed the connect-target highlight (and thereby the
 * connection) when the hovered element was a **class-linked instance**
 * whose class shares no association with the dragged-from instance's
 * class. `canElementConnect` gates on `"classId" in element` generically
 * — it has NO type allowlist:
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
 * Scoped to `objectName` and `UserModelName` endpoints — both node
 * families carry a meta-class-linking `classId`
 * (`IUMLObjectName.classId` / `IUMLUserModelName.classId` in v3) and are
 * therefore gated identically by `canElementConnect`. Other
 * classId-bearing node families (e.g. StateObjectNode) are NOT yet
 * covered by this rule — v3 gates them too, but wiring them in is
 * tracked separately (state-machine parity track) to avoid mixing
 * unrelated diagram behavior changes into this module.
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
  // v3 keyed the check off the hovered element's `classId` with no type
  // allowlist (`canElementConnect`, `connectable.tsx:530`). v4 scopes to
  // the node families known to carry a meta-class-linking `classId`
  // today — object instances and user-model instances — so unrelated
  // classId-bearing node shapes stay unaffected.
  const targetType = targetNode?.type
  if (targetType !== "objectName" && targetType !== "UserModelName") {
    return undefined
  }

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
