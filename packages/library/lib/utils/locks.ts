import type { Edge, EdgeChange, Node, NodeChange } from "@xyflow/react"
import { deepEqual } from "./storeUtils"
import { sortNodesTopologically } from "./nodeUtils"

/*
 * Element and diagram locks. Every edit the diagram store applies goes
 * through the guards below (model loads do not):
 * - a locked node keeps its position, size, parent, content and existence;
 * - a node inside a locked container keeps its position, size, parent and
 *   existence (its own content stays editable);
 * - a locked edge keeps its ends and content and cannot be removed; its
 *   route still follows its end nodes;
 * - a node that a kept node or a locked edge depends on (its container, an
 *   end of a locked edge) cannot be removed;
 * - a locked diagram accepts selection and measurement only.
 */

type Lockable = { locked?: boolean }

export const isLocked = (element: Node | Edge): boolean =>
  (element as Lockable).locked === true

/** Sets or clears the lock flag; an unlocked element carries no `locked` key. */
export const withLock = <T extends Node | Edge>(element: T, locked: boolean): T => {
  if (isLocked(element) === locked) return element
  const next: T & Lockable = { ...element }
  if (locked) next.locked = true
  else delete next.locked
  return next
}

export interface LockIndex {
  /** Nodes and edges that carry a lock of their own. */
  locked: ReadonlySet<string>
  /** Nodes whose position, size and parent are fixed: locked or inside a locked container. */
  pinned: ReadonlySet<string>
  /** Nodes and edges that cannot be removed. */
  undeletable: ReadonlySet<string>
}

const NO_LOCKS: LockIndex = {
  locked: new Set(),
  pinned: new Set(),
  undeletable: new Set(),
}

const buildLockIndex = (
  nodes: readonly Node[],
  edges: readonly Edge[]
): LockIndex => {
  const lockedNodes = nodes.filter(isLocked)
  const lockedEdges = edges.filter(isLocked)
  if (lockedNodes.length === 0 && lockedEdges.length === 0) return NO_LOCKS

  const children = new Map<string, string[]>()
  const parentOf = new Map<string, string>()
  for (const node of nodes) {
    if (!node.parentId) continue
    parentOf.set(node.id, node.parentId)
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id])
  }
  const pinned = new Set<string>()
  const stack = lockedNodes.map((node) => node.id)
  while (stack.length > 0) {
    const id = stack.pop()!
    if (pinned.has(id)) continue
    pinned.add(id)
    stack.push(...(children.get(id) ?? []))
  }

  const undeletable = new Set<string>(pinned)
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]))
  for (const edge of lockedEdges) {
    undeletable.add(edge.id)
    for (const end of [edge.source, edge.target]) {
      undeletable.add(end)
      // An association-class link ends on an association edge.
      const endEdge = edgeById.get(end)
      if (endEdge) undeletable.add(endEdge.source).add(endEdge.target)
    }
  }
  // Removing a container removes its content, so the containers of a kept
  // node are kept too.
  for (const id of [...undeletable]) {
    let parentId = parentOf.get(id)
    while (parentId && !undeletable.has(parentId)) {
      undeletable.add(parentId)
      parentId = parentOf.get(parentId)
    }
  }
  const locked = new Set(
    [...lockedNodes, ...lockedEdges].map((element) => element.id)
  )
  return { locked, pinned, undeletable }
}

const lockIndexCache = new WeakMap<
  readonly Node[],
  WeakMap<readonly Edge[], LockIndex>
>()

/** The lock index of a store snapshot, built once per `nodes` / `edges` pair. */
export const getLockIndex = (
  nodes: readonly Node[],
  edges: readonly Edge[]
): LockIndex => {
  let byEdges = lockIndexCache.get(nodes)
  let index = byEdges?.get(edges)
  if (index) return index
  index = buildLockIndex(nodes, edges)
  if (!byEdges) {
    byEdges = new WeakMap()
    lockIndexCache.set(nodes, byEdges)
  }
  byEdges.set(edges, index)
  return index
}

// View state and measurement are not content.
const nodeContent = ({
  selected,
  dragging,
  resizing,
  measured,
  hidden,
  locked,
  ...content
}: Node & Lockable) => content

// The route of a locked edge follows its end nodes.
const edgeContent = ({
  selected,
  locked,
  reconnectable,
  sourceHandle,
  targetHandle,
  data,
  ...content
}: Edge & Lockable) => ({ ...content, data: { ...data, points: undefined } })

/** `before` with the lock flag and selection of `after`. */
const keepContent = <T extends Node | Edge>(before: T, after: T): T =>
  withLock({ ...before, selected: after.selected }, isLocked(after))

const keepPinnedNode = (before: Node, after: Node): Node => {
  if (isLocked(before)) {
    return deepEqual(nodeContent(before), nodeContent(after))
      ? after
      : keepContent(before, after)
  }
  const sameGeometry =
    before.parentId === after.parentId &&
    before.width === after.width &&
    before.height === after.height &&
    before.position.x === after.position.x &&
    before.position.y === after.position.y
  return sameGeometry
    ? after
    : {
        ...after,
        position: before.position,
        width: before.width,
        height: before.height,
        parentId: before.parentId,
      }
}

const keepLockedEdge = (before: Edge, after: Edge): Edge =>
  !isLocked(before) || deepEqual(edgeContent(before), edgeContent(after))
    ? after
    : keepContent(before, after)

/** `prev` with only the selection of `next` applied (a locked diagram). */
const keepAllButSelection = <T extends Node | Edge>(prev: T[], next: T[]): T[] => {
  const nextById = new Map(next.map((element) => [element.id, element]))
  let changed = false
  const kept = prev.map((element) => {
    const after = nextById.get(element.id)
    if (!after || !!after.selected === !!element.selected) return element
    changed = true
    return { ...element, selected: after.selected }
  })
  return changed ? kept : prev
}

/** The part of a node list write (`prev` -> `next`) the locks allow. */
export const guardNodeEdit = (
  prev: Node[],
  next: Node[],
  edges: readonly Edge[],
  diagramLocked: boolean
): Node[] => {
  if (diagramLocked) return keepAllButSelection(prev, next)
  const { pinned, undeletable } = getLockIndex(prev, edges)
  if (undeletable.size === 0) return next
  const prevById = new Map(prev.map((node) => [node.id, node]))
  let changed = false
  const guarded = next.map((node) => {
    const before = prevById.get(node.id)
    if (!before || !pinned.has(node.id)) return node
    const kept = keepPinnedNode(before, node)
    if (kept !== node) changed = true
    return kept
  })
  const nextIds = new Set(next.map((node) => node.id))
  const restored = prev.filter(
    (node) => undeletable.has(node.id) && !nextIds.has(node.id)
  )
  if (restored.length > 0) return sortNodesTopologically([...guarded, ...restored])
  return changed ? guarded : next
}

/** The part of an edge list write (`prev` -> `next`) the locks allow. */
export const guardEdgeEdit = (
  prev: Edge[],
  next: Edge[],
  nodes: readonly Node[],
  diagramLocked: boolean
): Edge[] => {
  if (diagramLocked) return keepAllButSelection(prev, next)
  const { undeletable } = getLockIndex(nodes, prev)
  if (undeletable.size === 0) return next
  const prevById = new Map(prev.map((edge) => [edge.id, edge]))
  let changed = false
  const guarded = next.map((edge) => {
    const before = prevById.get(edge.id)
    if (!before) return edge
    const kept = keepLockedEdge(before, edge)
    if (kept !== edge) changed = true
    return kept
  })
  const nextIds = new Set(next.map((edge) => edge.id))
  const restored = prev.filter(
    (edge) => undeletable.has(edge.id) && !nextIds.has(edge.id)
  )
  if (restored.length > 0) return [...guarded, ...restored]
  return changed ? guarded : next
}

/** The React Flow node changes the locks allow. */
export const guardNodeChanges = (
  changes: NodeChange<Node>[],
  nodes: Node[],
  edges: readonly Edge[],
  diagramLocked: boolean
): NodeChange<Node>[] => {
  const { pinned, undeletable } = getLockIndex(nodes, edges)
  if (!diagramLocked && undeletable.size === 0) return changes
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return changes.flatMap((change): NodeChange<Node>[] => {
    switch (change.type) {
      case "add":
        return diagramLocked ? [] : [change]
      case "remove":
        return diagramLocked || undeletable.has(change.id) ? [] : [change]
      case "position":
        return diagramLocked || pinned.has(change.id) ? [] : [change]
      case "dimensions": {
        // A measurement carries neither flag; a resize gesture does.
        const resize = change.resizing !== undefined || !!change.setAttributes
        return resize && (diagramLocked || pinned.has(change.id)) ? [] : [change]
      }
      case "replace": {
        if (diagramLocked) return []
        const before = byId.get(change.id)
        if (!before || !pinned.has(change.id)) return [change]
        return [{ ...change, item: keepPinnedNode(before, change.item) }]
      }
      default:
        return [change]
    }
  })
}

/** The React Flow edge changes the locks allow. */
export const guardEdgeChanges = (
  changes: EdgeChange[],
  edges: Edge[],
  nodes: readonly Node[],
  diagramLocked: boolean
): EdgeChange[] => {
  const { undeletable } = getLockIndex(nodes, edges)
  if (!diagramLocked && undeletable.size === 0) return changes
  const byId = new Map(edges.map((edge) => [edge.id, edge]))
  return changes.flatMap((change): EdgeChange[] => {
    switch (change.type) {
      case "add":
        return diagramLocked ? [] : [change]
      case "remove":
        return diagramLocked || undeletable.has(change.id) ? [] : [change]
      case "replace": {
        if (diagramLocked) return []
        const before = byId.get(change.id)
        return before ? [{ ...change, item: keepLockedEdge(before, change.item) }] : [change]
      }
      default:
        return [change]
    }
  })
}
