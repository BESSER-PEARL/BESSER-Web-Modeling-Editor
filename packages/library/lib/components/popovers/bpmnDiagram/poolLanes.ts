import {
  POOL_HEADER_WIDTH,
  POOL_MIN_HEIGHT,
  SWIMLANE_MIN_HEIGHT,
  stackPoolLanes,
} from "@/hooks/useSwimlaneLayout"

/**
 * Pure lane edits behind the pool editor's lane list. Each keeps the pool
 * exactly wrapping its stacked lanes (`stackPoolLanes`), so a lane never
 * hangs outside its pool.
 */

type LaneNode = {
  id: string
  type?: string
  parentId?: string
  position: { x: number; y: number }
  width?: number
  height?: number
  measured?: { width?: number; height?: number }
  draggable?: boolean
  data: Record<string, unknown>
}

const lanesOf = <N extends LaneNode>(nodes: N[], poolId: string): N[] =>
  nodes
    .filter((n) => n.parentId === poolId && n.type === "bpmnSwimlane")
    .sort((a, b) => a.position.y - b.position.y)

const heightOf = (n: LaneNode, fallback: number): number =>
  n.height ?? n.measured?.height ?? fallback

const withPoolHeight = <N extends LaneNode>(
  nodes: N[],
  poolId: string,
  height: number
): N[] =>
  nodes.map((n) =>
    n.id === poolId
      ? { ...n, height, measured: { ...n.measured, height } }
      : n
  )

/**
 * Append a lane. The first lane fills the pool and adopts the pool's direct
 * children; later lanes go below the others and the pool grows to fit.
 */
export const addPoolLane = <N extends LaneNode>(
  nodes: N[],
  poolId: string,
  lane: { id: string; name: string }
): N[] => {
  const pool = nodes.find((n) => n.id === poolId)
  if (!pool) return nodes
  const lanes = lanesOf(nodes, poolId)
  const isFirstLane = lanes.length === 0
  const poolWidth = pool.width ?? pool.measured?.width ?? 200
  const poolHeight = heightOf(pool, POOL_MIN_HEIGHT)
  const existingTotal = lanes.reduce(
    (sum, l) => sum + heightOf(l, SWIMLANE_MIN_HEIGHT),
    0
  )
  const laneY = isFirstLane ? 0 : existingTotal
  const newLane = {
    id: lane.id,
    type: "bpmnSwimlane",
    parentId: poolId,
    position: { x: POOL_HEADER_WIDTH, y: laneY },
    width: poolWidth - POOL_HEADER_WIDTH,
    height: isFirstLane ? poolHeight : SWIMLANE_MIN_HEIGHT,
    // Lanes are pool-driven, not free-dragging.
    draggable: false,
    data: { name: lane.name },
  } as unknown as N
  let next = nodes
  if (isFirstLane) {
    next = next.map((n) =>
      n.parentId === poolId
        ? {
            ...n,
            parentId: lane.id,
            position: {
              x: n.position.x - POOL_HEADER_WIDTH,
              y: n.position.y - laneY,
            },
          }
        : n
    )
  } else {
    // Grow the pool by the new lane so the restack keeps every lane height.
    next = withPoolHeight(next, poolId, existingTotal + SWIMLANE_MIN_HEIGHT)
  }
  return stackPoolLanes([...next, newLane], poolId)
}

/**
 * Remove a lane. An empty lane takes its height with it (the pool shrinks);
 * a lane with content is merged into its neighbour (the one above, else
 * below), which absorbs its height so nothing moves on screen. Removing the
 * last lane hands its content back to the pool.
 */
export const removePoolLane = <N extends LaneNode>(
  nodes: N[],
  poolId: string,
  laneId: string
): N[] => {
  const lanes = lanesOf(nodes, poolId)
  const index = lanes.findIndex((l) => l.id === laneId)
  if (index === -1) return nodes
  const lane = lanes[index]
  const laneHeight = heightOf(lane, SWIMLANE_MIN_HEIGHT)
  const children = nodes.filter((n) => n.parentId === laneId)
  const neighbour = lanes[index - 1] ?? lanes[index + 1]

  if (!neighbour) {
    return nodes
      .map((n) =>
        n.parentId === laneId
          ? {
              ...n,
              parentId: poolId,
              position: {
                x: n.position.x + lane.position.x,
                y: n.position.y + lane.position.y,
              },
            }
          : n
      )
      .filter((n) => n.id !== laneId)
  }

  const poolHeight = lanes.reduce(
    (sum, l) => sum + heightOf(l, SWIMLANE_MIN_HEIGHT),
    0
  )
  if (children.length === 0) {
    const shrunk = withPoolHeight(
      nodes.filter((n) => n.id !== laneId),
      poolId,
      Math.max(poolHeight - laneHeight, POOL_MIN_HEIGHT)
    )
    return stackPoolLanes(shrunk, poolId)
  }

  // Merge: the neighbour spans both lanes; children keep their screen spot.
  const mergedY = Math.min(neighbour.position.y, lane.position.y)
  const mergedHeight = heightOf(neighbour, SWIMLANE_MIN_HEIGHT) + laneHeight
  const merged = nodes
    .filter((n) => n.id !== laneId)
    .map((n) => {
      if (n.id === neighbour.id) {
        return {
          ...n,
          position: { ...n.position, y: mergedY },
          height: mergedHeight,
          measured: { ...n.measured, height: mergedHeight },
        }
      }
      if (n.parentId === laneId) {
        return {
          ...n,
          parentId: neighbour.id,
          position: { x: n.position.x, y: n.position.y + lane.position.y - mergedY },
        }
      }
      if (n.parentId === neighbour.id) {
        return {
          ...n,
          position: {
            x: n.position.x,
            y: n.position.y + neighbour.position.y - mergedY,
          },
        }
      }
      return n
    })
  return stackPoolLanes(withPoolHeight(merged, poolId, poolHeight), poolId)
}

/**
 * Swap two lanes: their order AND their heights travel with them, so a
 * lane's content stays inside it.
 */
export const swapPoolLanes = <N extends LaneNode>(
  nodes: N[],
  poolId: string,
  i: number,
  j: number
): N[] => {
  const lanes = lanesOf(nodes, poolId)
  const a = lanes[i]
  const b = lanes[j]
  if (!a || !b) return nodes
  const [upper, lower] = a.position.y <= b.position.y ? [a, b] : [b, a]
  const lowerHeight = heightOf(lower, SWIMLANE_MIN_HEIGHT)
  // The lower lane moves to the upper slot; the upper one goes below it.
  const swapped = nodes.map((n) => {
    if (n.id === lower.id) {
      return { ...n, position: { ...n.position, y: upper.position.y } }
    }
    if (n.id === upper.id) {
      return {
        ...n,
        position: { ...n.position, y: upper.position.y + lowerHeight },
      }
    }
    return n
  })
  return stackPoolLanes(swapped, poolId)
}
