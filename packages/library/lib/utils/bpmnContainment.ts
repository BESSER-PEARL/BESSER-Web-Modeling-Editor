/**
 * Geometric containment repair for BPMN models.
 *
 * React Flow only moves a node together with a container when the node's
 * `parentId` points at it. BPMN models authored outside the canvas drop
 * handlers — the shipped templates (`pizza_store.json`, `car_wash.json`,
 * whose smart-generator v3 originals carried `owner: null` on every flow
 * node), assistant / backend output, or projects saved before this repair —
 * can have every task/event/gateway at the canvas root while visually sitting
 * inside a pool or lane. Dragging the pool then left its content behind.
 *
 * The old editor had no load-time repair either (its `ModelState.fromModel`
 * trusted `owner`); an element only became owned when it was dropped onto a
 * pool/lane (`create-pane.tsx`, `UMLContainerSaga.appendAfterMove`). This
 * module applies that same drop rule once, geometrically, to every
 * top-level BPMN element: it is adopted by the innermost container that
 * visually holds it, exactly as if the user had dropped it there.
 *
 * Rules:
 *  - Only top-level nodes (no `parentId`) are considered; already-parented
 *    nodes are never touched. Hence the pass is idempotent.
 *  - Containers: `bpmnPool`, `bpmnSwimlane`, and expanded `bpmnSubprocess` /
 *    `bpmnTransaction` (`data.isExpanded !== false`). Call activities and
 *    groups are not containers (old editor: CallActivity `droppable: false`;
 *    a group is a cross-cutting artifact).
 *  - A node is adopted by the smallest container whose bounds fully contain
 *    it and which `canDropIntoParent` accepts. When the innermost match is a
 *    pool that has lanes (the node straddles a lane border), the lane under
 *    the node's centre is used, as the old editor's hover-based drop did.
 *  - The position becomes parent-relative; lane children keep clear of the
 *    lane header strip (`clampIntoLaneBody`).
 *  - The node array is re-ordered only as far as React Flow requires
 *    (parents before children); relative order is otherwise preserved.
 */
import type { BesserNode, UMLModel } from "../typings"
import { canDropIntoParent, clampIntoLaneBody } from "./bpmnConstraints"
import { log } from "../logger"

const BPMN_DIAGRAM_TYPES = new Set(["BPMNDiagram", "BPMN"])

/** Top-level node types that may be adopted by a pool / lane / subprocess. */
const ADOPTABLE_TYPES = new Set([
  "bpmnTask",
  "bpmnStartEvent",
  "bpmnIntermediateEvent",
  "bpmnEndEvent",
  "bpmnGateway",
  "bpmnSubprocess",
  "bpmnTransaction",
  "bpmnCallActivity",
  "bpmnDataObject",
  "bpmnDataStore",
  "bpmnAnnotation",
  "bpmnGroup",
])

const EXPANDABLE_CONTAINER_TYPES = new Set(["bpmnSubprocess", "bpmnTransaction"])

type Rect = { x: number; y: number; width: number; height: number }

const sizeOf = (n: BesserNode): { width: number; height: number } => ({
  width: n.width ?? n.measured?.width ?? 0,
  height: n.height ?? n.measured?.height ?? 0,
})

const isContainer = (n: BesserNode): boolean => {
  const type = n.type as string
  if (type === "bpmnPool" || type === "bpmnSwimlane") return true
  if (EXPANDABLE_CONTAINER_TYPES.has(type)) {
    return (n.data as { isExpanded?: unknown } | undefined)?.isExpanded !== false
  }
  return false
}

const contains = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height

const containsPoint = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height

/**
 * Stable parent-before-child ordering: each node keeps its relative position
 * unless it precedes its parent, in which case it is emitted right after the
 * parent chain. Cycles / dangling parents are tolerated (node emitted as-is).
 */
export const orderParentsFirst = <N extends { id: string; parentId?: string }>(
  nodes: N[]
): N[] => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const emitted = new Set<string>()
  const visiting = new Set<string>()
  const out: N[] = []
  const visit = (n: N) => {
    if (emitted.has(n.id) || visiting.has(n.id)) return
    visiting.add(n.id)
    const parent = n.parentId ? byId.get(n.parentId) : undefined
    if (parent) visit(parent)
    visiting.delete(n.id)
    emitted.add(n.id)
    out.push(n)
  }
  nodes.forEach(visit)
  return out
}

/**
 * Adopt every top-level BPMN element that visually sits inside a pool, lane
 * or expanded subprocess/transaction (see module doc). Returns the input
 * model unchanged (same reference) when nothing needs adopting or the model
 * is not a BPMN diagram.
 */
export function adoptBpmnContainment(model: UMLModel): UMLModel {
  if (!model || !BPMN_DIAGRAM_TYPES.has(model.type as string)) return model
  const nodes = Array.isArray(model.nodes) ? model.nodes : []
  if (nodes.length === 0) return model

  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Absolute (flow) rectangle of every node, walking the parentId chain.
  const absCache = new Map<string, Rect>()
  const absRect = (n: BesserNode): Rect => {
    const cached = absCache.get(n.id)
    if (cached) return cached
    let x = n.position?.x ?? 0
    let y = n.position?.y ?? 0
    const seen = new Set<string>([n.id])
    let parent = n.parentId ? byId.get(n.parentId) : undefined
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      x += parent.position?.x ?? 0
      y += parent.position?.y ?? 0
      parent = parent.parentId ? byId.get(parent.parentId) : undefined
    }
    const rect = { x, y, ...sizeOf(n) }
    absCache.set(n.id, rect)
    return rect
  }

  const containers = nodes.filter(isContainer)
  if (containers.length === 0) return model

  const isAncestor = (maybeAncestorId: string, n: BesserNode): boolean => {
    const seen = new Set<string>()
    let cur = n.parentId ? byId.get(n.parentId) : undefined
    while (cur && !seen.has(cur.id)) {
      if (cur.id === maybeAncestorId) return true
      seen.add(cur.id)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return false
  }

  const lanesOf = (poolId: string) =>
    containers.filter(
      (c) => c.parentId === poolId && (c.type as string) === "bpmnSwimlane"
    )

  // Decide every adoption against the ORIGINAL geometry first, so the result
  // does not depend on array order.
  const adoptions = new Map<string, BesserNode>()
  for (const node of nodes) {
    if (node.parentId) continue
    const childType = node.type as string
    if (!ADOPTABLE_TYPES.has(childType)) continue
    const rect = absRect(node)
    if (rect.width <= 0 && rect.height <= 0) continue

    let best: BesserNode | undefined
    let bestArea = Infinity
    for (const container of containers) {
      if (container.id === node.id) continue
      if (isAncestor(node.id, container)) continue
      if (!canDropIntoParent(childType, container.type as string)) continue
      const cRect = absRect(container)
      if (!contains(cRect, rect)) continue
      const area = cRect.width * cRect.height
      // `<=`: on a tie the later (painted on top) container wins.
      if (area <= bestArea) {
        best = container
        bestArea = area
      }
    }
    if (!best) continue

    // Straddling a lane border inside a laned pool → the lane under the
    // node's centre (a laned pool's area is fully covered by its lanes).
    if ((best.type as string) === "bpmnPool") {
      const lanes = lanesOf(best.id).filter((l) =>
        canDropIntoParent(childType, l.type as string)
      )
      if (lanes.length > 0) {
        const cx = rect.x + rect.width / 2
        const cy = rect.y + rect.height / 2
        const lane = lanes.find((l) => containsPoint(absRect(l), cx, cy))
        if (lane) best = lane
      }
    }
    adoptions.set(node.id, best)
  }

  if (adoptions.size === 0) return model

  const adopted = nodes.map((node) => {
    const parent = adoptions.get(node.id)
    if (!parent) return node
    const rect = absRect(node)
    const pRect = absRect(parent)
    const position = clampIntoLaneBody(
      { x: rect.x - pRect.x, y: rect.y - pRect.y },
      parent.type as string
    )
    return { ...node, parentId: parent.id, position }
  })

  log.debug(
    `adoptBpmnContainment: parented ${adoptions.size} top-level BPMN ` +
      `element(s) to their enclosing pool / lane / subprocess.`
  )
  return { ...model, nodes: orderParentsFirst(adopted) }
}
