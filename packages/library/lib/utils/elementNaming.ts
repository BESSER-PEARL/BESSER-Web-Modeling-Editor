import type { Edge, Node, XYPosition } from "@xyflow/react"
import { CANVAS } from "@/constants"

/**
 * Node types whose names must be unique in a diagram (the backend resolves
 * classes and agent states by name). Enumerations are `class` nodes too.
 */
const UNIQUE_NAME_TYPES: ReadonlySet<string> = new Set(["class", "AgentState"])

export const needsUniqueName = (type: string | undefined): boolean =>
  !!type && UNIQUE_NAME_TYPES.has(type)

const nameOf = (node: Node): string | undefined => {
  const name = (node.data as { name?: unknown } | undefined)?.name
  return typeof name === "string" && name !== "" ? name : undefined
}

const takenNames = (type: string, nodes: readonly Node[]): Set<string> =>
  new Set(
    nodes.flatMap((n) => {
      const name = n.type === type ? nameOf(n) : undefined
      return name ? [name] : []
    })
  )

/** Palette default name, numbered: Class -> Class1, Class2, ... */
export const nextNumberedName = (base: string, taken: ReadonlySet<string>) => {
  let i = 1
  while (taken.has(`${base}${i}`)) i += 1
  return `${base}${i}`
}

/**
 * Name for a copy: unchanged when free (cut + paste keeps the name), else the
 * next free number: Book -> Book2, Class1 -> Class2.
 */
export const nextFreeCopyName = (name: string, taken: ReadonlySet<string>) => {
  if (!taken.has(name)) return name
  const match = /^(.*?)(\d+)$/.exec(name)
  const base = match ? match[1] : name
  let i = match ? Number(match[2]) + 1 : 2
  while (taken.has(`${base}${i}`)) i += 1
  return `${base}${i}`
}

const withName = (node: Node, name: string): Node =>
  nameOf(node) === name ? node : { ...node, data: { ...node.data, name } }

/** A freshly created palette element gets a numbered name (Class1, Class2, ...). */
export const withNumberedPaletteName = (
  node: Node,
  existing: readonly Node[]
): Node => {
  const name = nameOf(node)
  if (!name || !needsUniqueName(node.type)) return node
  return withName(node, nextNumberedName(name, takenNames(node.type!, existing)))
}

/** Pasted copies get the next free name where theirs is already taken. */
export const withUniqueCopyNames = (
  pasted: readonly Node[],
  existing: readonly Node[]
): Node[] => {
  const taken = new Map<string, Set<string>>()
  return pasted.map((node) => {
    const name = nameOf(node)
    if (!name || !needsUniqueName(node.type)) return node
    let names = taken.get(node.type!)
    if (!names) {
      names = takenNames(node.type!, existing)
      taken.set(node.type!, names)
    }
    const unique = nextFreeCopyName(name, names)
    names.add(unique)
    return withName(node, unique)
  })
}

/**
 * Moves pasted elements so the bounding box of their root nodes is centred
 * on `target` (flow coordinates, grid-snapped shift). Child positions are
 * parent-relative and follow their parent; edge bend points move with the
 * roots. A lone child pasted back into its original parent is left alone.
 */
export const centerPastedOn = (
  nodes: readonly Node[],
  edges: readonly Edge[],
  target: XYPosition
): { nodes: Node[]; edges: Edge[] } => {
  const ids = new Set(nodes.map((n) => n.id))
  const roots = nodes.filter((n) => !n.parentId || !ids.has(n.parentId))
  if (roots.length === 0 || roots.some((n) => n.parentId)) {
    return { nodes: [...nodes], edges: [...edges] }
  }
  const size = (n: Node) => ({
    w: n.width ?? n.measured?.width ?? 0,
    h: n.height ?? n.measured?.height ?? 0,
  })
  const minX = Math.min(...roots.map((n) => n.position.x))
  const minY = Math.min(...roots.map((n) => n.position.y))
  const maxX = Math.max(...roots.map((n) => n.position.x + size(n).w))
  const maxY = Math.max(...roots.map((n) => n.position.y + size(n).h))
  const grid = CANVAS.SNAP_TO_GRID_PX
  const dx = Math.round((target.x - (minX + maxX) / 2) / grid) * grid
  const dy = Math.round((target.y - (minY + maxY) / 2) / grid) * grid
  if (dx === 0 && dy === 0) return { nodes: [...nodes], edges: [...edges] }
  const rootIds = new Set(roots.map((n) => n.id))
  return {
    nodes: nodes.map((n) =>
      rootIds.has(n.id)
        ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
        : n
    ),
    edges: edges.map((e) => {
      const points = e.data?.points
      if (!Array.isArray(points)) return e
      return {
        ...e,
        data: {
          ...e.data,
          points: (points as XYPosition[]).map((p) => ({
            x: p.x + dx,
            y: p.y + dy,
          })),
        },
      }
    }),
  }
}
