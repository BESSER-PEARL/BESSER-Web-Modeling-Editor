import { Node } from "@xyflow/react"
import { AlignmentGuide } from "@/store/alignmentGuidesStore"
import { isParentNodeType } from "@/utils/nodeUtils"

const ALIGNMENT_THRESHOLD = 10 // pixels within which guides appear

export type AlignmentInfo = {
  horizontalGuides: number[] // x positions for vertical alignment lines
  verticalGuides: number[] // y positions for horizontal alignment lines
  snappedPosition?: {
    x?: number
    y?: number
  }
}

type PositionResolver = (node: Node) => { x: number; y: number }

/**
 * Memoized absolute (canvas) position lookup for one guide computation.
 * Child positions are relative to their parent, so nested nodes must be
 * compared in canvas space (upstream Apollon #680). Built once per call so
 * a drag frame stays O(N * depth) instead of re-walking the parent chain
 * with a linear `find` for every comparison.
 */
const createAbsolutePositionResolver = (
  allNodes: Node[]
): PositionResolver => {
  const byId = new Map(allNodes.map((node) => [node.id, node]))
  const cache = new Map<string, { x: number; y: number }>()
  const resolve: PositionResolver = (node) => {
    const cached = cache.get(node.id)
    if (cached) return cached
    // Seed the cache first so a malformed cyclic parent chain terminates.
    cache.set(node.id, node.position)
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    const base = parent ? resolve(parent) : { x: 0, y: 0 }
    const absolute = {
      x: base.x + node.position.x,
      y: base.y + node.position.y,
    }
    cache.set(node.id, absolute)
    return absolute
  }
  return resolve
}

/**
 * Get the bounds of a node (considering its position and dimensions).
 * Given `allNodes` (or a resolver) the bounds are in canvas space, i.e. the
 * offsets of a child's parent chain are applied.
 */
export const getNodeBounds = (
  node: Node,
  allNodes?: Node[] | PositionResolver
) => {
  const position =
    typeof allNodes === "function"
      ? allNodes(node)
      : allNodes
        ? createAbsolutePositionResolver(allNodes)(node)
        : node.position
  const x = position.x
  const y = position.y
  const width = node.measured?.width || 100
  const height = node.measured?.height || 100

  return {
    left: x,
    right: x + width,
    top: y,
    bottom: y + height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  }
}

/**
 * The container a node visually sits in: its `parentId`, or else the
 * smallest parent-type node whose bounds fully contain it (a node lying on
 * a package without being reparented).
 */
const getContainingParentId = (
  node: Node,
  allNodes: Node[],
  resolve: PositionResolver,
  excludeParentId?: string
) => {
  if (node.parentId) {
    return node.parentId
  }

  const nodeBounds = getNodeBounds(node, resolve)
  let bestParent: Node | undefined
  let bestArea = Infinity

  for (const candidate of allNodes) {
    if (
      candidate.id === node.id ||
      candidate.id === excludeParentId ||
      !isParentNodeType(candidate.type)
    ) {
      continue
    }

    const parentBounds = getNodeBounds(candidate, resolve)
    const contains =
      nodeBounds.left >= parentBounds.left &&
      nodeBounds.right <= parentBounds.right &&
      nodeBounds.top >= parentBounds.top &&
      nodeBounds.bottom <= parentBounds.bottom

    if (!contains) {
      continue
    }

    const area =
      (parentBounds.right - parentBounds.left) *
      (parentBounds.bottom - parentBounds.top)
    if (area < bestArea) {
      bestArea = area
      bestParent = candidate
    }
  }

  return bestParent?.id
}

/**
 * Which nodes a dragged node aligns against (upstream Apollon #680): a
 * top-level node aligns with everything, including parent frames and the
 * nodes nested in them. A child skips its own container (no point snapping
 * to your own frame) and aligns with its siblings and with top-level nodes
 * -- not with nodes nested in some unrelated container.
 */
const shouldUseAsGuideTarget = (
  draggedNode: Node,
  node: Node,
  allNodes: Node[],
  resolve: PositionResolver,
  draggedParentId: string | undefined
) => {
  if (!draggedParentId) {
    return true
  }

  if (node.id === draggedParentId) {
    return false
  }

  const nodeParentId = getContainingParentId(
    node,
    allNodes,
    resolve,
    draggedNode.id
  )
  const isSibling = nodeParentId === draggedParentId
  const isTopLevel = !nodeParentId

  return isSibling || isTopLevel
}

/**
 * Calculate alignment guides based on dragged node and other nodes. All
 * comparisons -- and the returned guide positions -- are in canvas space,
 * so nested nodes align correctly with nodes outside their container.
 */
export const calculateAlignmentGuides = (
  draggedNode: Node,
  allNodes: Node[],
  threshold: number = ALIGNMENT_THRESHOLD
): AlignmentGuide[] => {
  // The store copy of the dragged node may lag the live drag frame.
  const nodesWithDrag = allNodes.map((node) =>
    node.id === draggedNode.id ? draggedNode : node
  )
  const resolve = createAbsolutePositionResolver(nodesWithDrag)
  const draggedParentId = draggedNode.parentId
  const draggedBounds = getNodeBounds(draggedNode, resolve)
  const guides: AlignmentGuide[] = []
  const alignedPositions = new Set<number>()

  // The dragged node's own descendants move with it, so aligning against
  // them is meaningless (BESSER addition).
  const movingIds = new Set([draggedNode.id])
  let grew = true
  while (grew) {
    grew = false
    for (const node of nodesWithDrag) {
      if (
        node.parentId &&
        movingIds.has(node.parentId) &&
        !movingIds.has(node.id)
      ) {
        movingIds.add(node.id)
        grew = true
      }
    }
  }

  const otherNodes = nodesWithDrag.filter(
    (node) =>
      !movingIds.has(node.id) &&
      shouldUseAsGuideTarget(
        draggedNode,
        node,
        nodesWithDrag,
        resolve,
        draggedParentId
      )
  )

  for (const node of otherNodes) {
    const nodeBounds = getNodeBounds(node, resolve)

    // Vertical alignment (left, center, right edges)
    const verticalAlignments = [
      { pos: nodeBounds.left, name: "left" },
      { pos: nodeBounds.centerX, name: "center" },
      { pos: nodeBounds.right, name: "right" },
    ]

    const horizontalAlignments = [
      { pos: nodeBounds.top, name: "top" },
      { pos: nodeBounds.centerY, name: "center" },
      { pos: nodeBounds.bottom, name: "bottom" },
    ]

    // Check vertical alignment (draw vertical line for horizontal alignment)
    for (const alignment of verticalAlignments) {
      if (Math.abs(draggedBounds.left - alignment.pos) < threshold) {
        if (!alignedPositions.has(alignment.pos)) {
          guides.push({
            id: `vertical-${alignment.pos}`,
            type: "vertical",
            position: alignment.pos,
          })
          alignedPositions.add(alignment.pos)
        }
      }
      if (Math.abs(draggedBounds.centerX - alignment.pos) < threshold) {
        if (!alignedPositions.has(alignment.pos)) {
          guides.push({
            id: `vertical-center-${alignment.pos}`,
            type: "vertical",
            position: alignment.pos,
          })
          alignedPositions.add(alignment.pos)
        }
      }
      if (Math.abs(draggedBounds.right - alignment.pos) < threshold) {
        if (!alignedPositions.has(alignment.pos)) {
          guides.push({
            id: `vertical-right-${alignment.pos}`,
            type: "vertical",
            position: alignment.pos,
          })
          alignedPositions.add(alignment.pos)
        }
      }
    }

    // Check horizontal alignment (draw horizontal line for vertical alignment)
    for (const alignment of horizontalAlignments) {
      if (Math.abs(draggedBounds.top - alignment.pos) < threshold) {
        if (!alignedPositions.has(alignment.pos)) {
          guides.push({
            id: `horizontal-${alignment.pos}`,
            type: "horizontal",
            position: alignment.pos,
          })
          alignedPositions.add(alignment.pos)
        }
      }
      if (Math.abs(draggedBounds.centerY - alignment.pos) < threshold) {
        if (!alignedPositions.has(alignment.pos)) {
          guides.push({
            id: `horizontal-center-${alignment.pos}`,
            type: "horizontal",
            position: alignment.pos,
          })
          alignedPositions.add(alignment.pos)
        }
      }
      if (Math.abs(draggedBounds.bottom - alignment.pos) < threshold) {
        if (!alignedPositions.has(alignment.pos)) {
          guides.push({
            id: `horizontal-bottom-${alignment.pos}`,
            type: "horizontal",
            position: alignment.pos,
          })
          alignedPositions.add(alignment.pos)
        }
      }
    }
  }

  return guides
}

/**
 * Snap node position to nearby nodes
 */
export const snapNodeToGuides = (
  draggedNode: Node,
  guides: AlignmentGuide[],
  threshold: number = ALIGNMENT_THRESHOLD,
  allNodes?: Node[]
): { x?: number; y?: number } => {
  // Guides are in canvas space; given `allNodes`, a nested node is compared
  // by its canvas position while the snapped offset stays parent-relative.
  const resolve = allNodes
    ? createAbsolutePositionResolver(
        allNodes.map((node) =>
          node.id === draggedNode.id ? draggedNode : node
        )
      )
    : undefined
  const draggedBounds = getNodeBounds(draggedNode, resolve)
  const draggedPosition = resolve ? resolve(draggedNode) : draggedNode.position
  const snappedPosition: { x?: number; y?: number } = {}

  for (const guide of guides) {
    if (guide.type === "vertical") {
      // Snap left edge
      if (Math.abs(draggedBounds.left - guide.position) < threshold) {
        snappedPosition.x = guide.position - draggedPosition.x
      }
      // Snap center
      if (Math.abs(draggedBounds.centerX - guide.position) < threshold) {
        snappedPosition.x =
          guide.position -
          draggedPosition.x -
          (draggedNode.measured?.width || 100) / 2
      }
      // Snap right edge
      if (Math.abs(draggedBounds.right - guide.position) < threshold) {
        snappedPosition.x =
          guide.position -
          draggedPosition.x -
          (draggedNode.measured?.width || 100)
      }
    } else if (guide.type === "horizontal") {
      // Snap top edge
      if (Math.abs(draggedBounds.top - guide.position) < threshold) {
        snappedPosition.y = guide.position - draggedPosition.y
      }
      // Snap center
      if (Math.abs(draggedBounds.centerY - guide.position) < threshold) {
        snappedPosition.y =
          guide.position -
          draggedPosition.y -
          (draggedNode.measured?.height || 100) / 2
      }
      // Snap bottom edge
      if (Math.abs(draggedBounds.bottom - guide.position) < threshold) {
        snappedPosition.y =
          guide.position -
          draggedPosition.y -
          (draggedNode.measured?.height || 100)
      }
    }
  }

  return snappedPosition
}
