import { OnResize, useReactFlow, type Node } from "@xyflow/react"
import { useCallback } from "react"

/**
 * Pool ↔ lane layout synchronization for BPMN swimlanes.
 *
 * React-Flow port of develop's `bpmn-pool/bpmn-pool.ts` `render()`
 * lane-stacking algorithm. There is no pre-existing "auto-fit children"
 * precedent anywhere else in the migration codebase, so this is new
 * machinery rather than a small edit.
 *
 * In this model a pool's lanes are React-Flow child nodes
 * (`parentId === poolId`, `type === "bpmnSwimlane"`), positioned relative
 * to the pool. The invariants enforced here mirror develop's render():
 *
 *  (a) each lane is locked to `x = HEADER_WIDTH`, stacked sequentially in
 *      `y`, with `width = pool.width - HEADER_WIDTH`;
 *  (b) dragging the pool's bottom edge shorter than the summed lane
 *      heights shrinks the LAST lane (floor `SWIMLANE_MIN_HEIGHT`);
 *  (c) a first lane dropped into a tall empty pool expands to fill the
 *      remaining height instead of snapping the pool down;
 *  (d) whenever lanes exist the pool's own height is forced to exactly the
 *      summed lane heights (a laned pool is not independently vertically
 *      resizable — only an empty pool is);
 *  (e) dragging the pool's TOP edge compensates the pool's `y` by the
 *      rejected height delta so the pool doesn't drift upward.
 */

export const POOL_HEADER_WIDTH = 40
export const POOL_MIN_HEIGHT = 80
export const SWIMLANE_MIN_WIDTH = 80
export const SWIMLANE_MIN_HEIGHT = 80

/**
 * Pure variant of `relayoutPool` for a node array, used when a lane is
 * dropped from the palette into a pool: the pool's lanes are stacked
 * top-to-bottom (ordered by their current `y`, so the drop point decides
 * where the new lane lands), locked to `x = POOL_HEADER_WIDTH` with
 * `width = pool.width - POOL_HEADER_WIDTH`; the last lane fills a taller
 * pool (c), otherwise the pool grows to the summed lane heights (d).
 * Returns the input array unchanged when `poolId` has no lanes.
 */
export function stackPoolLanes<
  N extends {
    id: string
    type?: string
    parentId?: string
    position: { x: number; y: number }
    width?: number
    height?: number
    measured?: { width?: number; height?: number }
  },
>(nodes: N[], poolId: string): N[] {
  const pool = nodes.find((n) => n.id === poolId)
  if (!pool) return nodes
  const lanes = nodes
    .filter((n) => n.parentId === poolId && n.type === "bpmnSwimlane")
    .sort((a, b) => a.position.y - b.position.y)
  if (lanes.length === 0) return nodes

  const poolWidth = pool.width ?? pool.measured?.width ?? 200
  const poolHeight = pool.height ?? pool.measured?.height ?? POOL_MIN_HEIGHT
  const laneWidth = Math.max(poolWidth - POOL_HEADER_WIDTH, SWIMLANE_MIN_WIDTH)
  const heights = lanes.map((l) =>
    Math.max(l.height ?? l.measured?.height ?? SWIMLANE_MIN_HEIGHT, SWIMLANE_MIN_HEIGHT)
  )
  let total = heights.reduce((s, h) => s + h, 0)
  if (total < poolHeight) {
    heights[heights.length - 1] += poolHeight - total
    total = poolHeight
  }
  const laneLayout = new Map<string, { y: number; height: number }>()
  let y = 0
  lanes.forEach((lane, i) => {
    laneLayout.set(lane.id, { y, height: heights[i] })
    y += heights[i]
  })
  const newPoolHeight = Math.max(total, POOL_MIN_HEIGHT)

  return nodes.map((n) => {
    const lane = laneLayout.get(n.id)
    if (lane) {
      return {
        ...n,
        position: { x: POOL_HEADER_WIDTH, y: lane.y },
        width: laneWidth,
        height: lane.height,
        measured: { width: laneWidth, height: lane.height },
      }
    }
    if (n.id === poolId) {
      return {
        ...n,
        width: poolWidth,
        height: newPoolHeight,
        measured: { width: poolWidth, height: newPoolHeight },
      }
    }
    return n
  })
}

interface RelayoutOptions {
  /** Intended pool width for this pass. */
  poolWidth: number
  /**
   * Intended pool height for this pass. Used for the bottom-edge shrink
   * (b) and empty-pool fill (c) comparisons. Pass `0` (or any value below
   * the summed lane heights) to make the pool purely lane-driven (d).
   */
  poolHeight: number
  /** Pool position (flow coords); only `y` is adjusted on a top-edge drag. */
  poolX: number
  poolY: number
  /** Bottom-edge drag: absorb an under-drag into the last lane (b). */
  shrinkLast?: boolean
  /** Top-edge drag: compensate pool `y` for the rejected height delta (e). */
  topEdge?: boolean
  /**
   * A lane whose height changed this frame (its own resize). React-Flow may
   * not have committed the new size to the node yet, so the caller passes
   * it explicitly.
   */
  laneOverride?: { id: string; height: number }
}

export function useSwimlaneLayout() {
  const { getNode, getNodes, updateNode } = useReactFlow()

  /** A pool's swimlane children, ordered top-to-bottom. */
  const getLanes = useCallback(
    (poolId: string): Node[] =>
      getNodes()
        .filter((n) => n.parentId === poolId && n.type === "bpmnSwimlane")
        .sort((a, b) => a.position.y - b.position.y),
    [getNodes]
  )

  const relayoutPool = useCallback(
    (poolId: string, opts: RelayoutOptions) => {
      const lanes = getLanes(poolId)

      // No lanes: the pool drives its own height (features.resizable ===
      // true in develop). Respect the dragged height; enforce only a floor.
      if (lanes.length === 0) {
        updateNode(poolId, {
          width: opts.poolWidth,
          height: Math.max(opts.poolHeight, POOL_MIN_HEIGHT),
        })
        return
      }

      const expectedLaneWidth = opts.poolWidth - POOL_HEADER_WIDTH

      // Resolved lane heights (floor-clamped; override the actively-resized
      // lane with its in-flight height).
      const laneHeights = lanes.map((lane) => {
        const h =
          opts.laneOverride && opts.laneOverride.id === lane.id
            ? opts.laneOverride.height
            : (lane.height ?? SWIMLANE_MIN_HEIGHT)
        return Math.max(h, SWIMLANE_MIN_HEIGHT)
      })

      // (b) Bottom-edge under-drag: shrink the last lane to absorb the delta.
      if (opts.shrinkLast) {
        const currentTotal = laneHeights.reduce((s, h) => s + h, 0)
        if (opts.poolHeight < currentTotal) {
          const shrinkBy = currentTotal - opts.poolHeight
          const last = laneHeights.length - 1
          laneHeights[last] = Math.max(
            laneHeights[last] - shrinkBy,
            SWIMLANE_MIN_HEIGHT
          )
        }
      }

      // (a) Stack lanes top-to-bottom.
      let currentY = 0
      const stacked = lanes.map((lane, i) => {
        const y = currentY
        currentY += laneHeights[i]
        return { id: lane.id, y, height: laneHeights[i] }
      })

      // (c) First lane on a tall empty pool: expand the last lane to fill
      // instead of snapping the pool down.
      if (currentY < opts.poolHeight && stacked.length > 0) {
        const last = stacked.length - 1
        stacked[last].height += opts.poolHeight - currentY
        currentY = opts.poolHeight
      }

      // Apply lane positions/sizes.
      for (const s of stacked) {
        updateNode(s.id, {
          position: { x: POOL_HEADER_WIDTH, y: s.y },
          width: expectedLaneWidth,
          height: s.height,
        })
      }

      // (d) Force the pool height to exactly fit the lanes;
      // (e) compensate `y` on a top-edge drag so it doesn't drift.
      const desiredHeight = Math.max(currentY, POOL_MIN_HEIGHT)
      const patch: Partial<Node> = {
        width: opts.poolWidth,
        height: desiredHeight,
      }
      if (opts.topEdge) {
        patch.position = {
          x: opts.poolX,
          y: opts.poolY + (opts.poolHeight - desiredHeight),
        }
      }
      updateNode(poolId, patch)
    },
    [getLanes, updateNode]
  )

  /** NodeResizer `onResize` handler for a pool. */
  const onPoolResize = useCallback(
    (poolId: string): OnResize =>
      (_event, params) => {
        const bottomEdge = params.direction[1] === 1
        const topEdge = params.direction[1] === -1
        relayoutPool(poolId, {
          poolWidth: params.width,
          poolHeight: params.height,
          poolX: params.x,
          poolY: params.y,
          shrinkLast: bottomEdge,
          topEdge,
        })
      },
    [relayoutPool]
  )

  /**
   * NodeResizer `onResize` handler for a lane. A lane height change
   * re-flows the whole pool; the pool height becomes lane-driven.
   */
  const onLaneResize = useCallback(
    (poolId: string, laneId: string): OnResize =>
      (_event, params) => {
        const pool = getNode(poolId)
        if (!pool) return
        relayoutPool(poolId, {
          poolWidth: pool.width ?? params.width + POOL_HEADER_WIDTH,
          // Force pool height = summed lane heights (lane-driven).
          poolHeight: 0,
          poolX: pool.position.x,
          poolY: pool.position.y,
          laneOverride: { id: laneId, height: params.height },
        })
      },
    [getNode, relayoutPool]
  )

  return { onPoolResize, onLaneResize, relayoutPool }
}
