import type { Node } from "@xyflow/react"

export type NodeSize = { width?: number; height?: number }

/**
 * Applies a content-driven size (`width` / `height`, mirrored into
 * `measured`) to node `id`, for the mount-time sizing effects of nodes that
 * clamp themselves to their content (Class, ObjectName, UserModelName, …).
 *
 * Idempotent by construction: when the node already carries the requested
 * size -- in `width` / `height` *and* in `measured` -- the input array is
 * returned unchanged, so `setNodes` writes nothing to the Y.Doc. That
 * matters for undo/redo: every node a redo re-adds remounts and re-runs
 * these effects, and any tracked Yjs write at that point is a new change
 * that makes the UndoManager drop the whole redo stack.
 *
 * `measured` is merged, never replaced: rebuilding it from one axis
 * (`measured: { width }`) dropped the other and turned a would-be no-op
 * into a real write.
 */
export function applyNodeSize(
  nodes: Node[],
  id: string,
  size: NodeSize
): Node[] {
  const index = nodes.findIndex((node) => node.id === id)
  if (index === -1) return nodes
  const node = nodes[index]

  const sameWidth =
    size.width === undefined ||
    (node.width === size.width && node.measured?.width === size.width)
  const sameHeight =
    size.height === undefined ||
    (node.height === size.height && node.measured?.height === size.height)
  if (sameWidth && sameHeight) return nodes

  const next = nodes.slice()
  next[index] = {
    ...node,
    ...(size.width !== undefined && { width: size.width }),
    ...(size.height !== undefined && { height: size.height }),
    measured: {
      ...node.measured,
      ...(size.width !== undefined && { width: size.width }),
      ...(size.height !== undefined && { height: size.height }),
    },
  }
  return next
}
