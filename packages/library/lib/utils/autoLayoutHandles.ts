/**
 * Handle geometry shared by the auto-layout pipeline: which connection
 * handles a node type exposes, where they sit on the node border, and how
 * the edge ends that land on one side of a node are spread over that side's
 * handles.
 *
 * Mirrors `DefaultNodeWrapper` (3 visible handles per side at 20% / 50% /
 * 80%) and the node types that hide some of them (circles, diamonds,
 * events, fork bars — see each node's `hiddenHandles`).
 */

export type HandleSide = "top" | "bottom" | "left" | "right"

export interface LayoutPoint {
  x: number
  y: number
}

export interface LayoutRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The connectable handles on each side, ordered along the side's axis
 * (left→right for top/bottom, top→bottom for left/right). These are the three
 * visible handles per side (at 20% / 50% / 80%); spreading edges across them
 * stops multiple relationships from piling onto a single centre point.
 */
export const SIDE_HANDLES: Record<HandleSide, readonly string[]> = {
  top: ["top-left", "top", "top-right"],
  bottom: ["bottom-left", "bottom", "bottom-right"],
  left: ["left-top", "left", "left-bottom"],
  right: ["right-top", "right", "right-bottom"],
}

const SIDE_FRACTIONS = [0.2, 0.5, 0.8] as const

/** Every handle id the node wrappers render (incl. the hidden mid ones) → side + fraction. */
const HANDLE_GEOMETRY: Record<string, { side: HandleSide; fraction: number }> = {
  "top-left": { side: "top", fraction: 0.2 },
  "top-mid-left": { side: "top", fraction: 0.35 },
  top: { side: "top", fraction: 0.5 },
  "top-mid-right": { side: "top", fraction: 0.65 },
  "top-right": { side: "top", fraction: 0.8 },
  "bottom-left": { side: "bottom", fraction: 0.2 },
  "bottom-mid-left": { side: "bottom", fraction: 0.35 },
  bottom: { side: "bottom", fraction: 0.5 },
  "bottom-mid-right": { side: "bottom", fraction: 0.65 },
  "bottom-right": { side: "bottom", fraction: 0.8 },
  "left-top": { side: "left", fraction: 0.2 },
  "left-mid-top": { side: "left", fraction: 0.35 },
  left: { side: "left", fraction: 0.5 },
  "left-mid-bottom": { side: "left", fraction: 0.65 },
  "left-bottom": { side: "left", fraction: 0.8 },
  "right-top": { side: "right", fraction: 0.2 },
  "right-mid-top": { side: "right", fraction: 0.35 },
  right: { side: "right", fraction: 0.5 },
  "right-mid-bottom": { side: "right", fraction: 0.65 },
  "right-bottom": { side: "right", fraction: 0.8 },
}

/** Node types that only expose the four side-centre handles. */
const CENTRE_HANDLE_TYPES: ReadonlySet<string> = new Set([
  "activityInitialNode",
  "activityFinalNode",
  "bpmnStartEvent",
  "bpmnIntermediateEvent",
  "bpmnEndEvent",
  "bpmnGateway",
  "componentInterface",
  "deploymentInterface",
  "flowchartDecision",
  "flowchartInputOutput",
  "petriNetPlace",
  "sfcTransitionBranch",
  "StateInitialNode",
  "StateFinalNode",
  "useCase",
])

/** Thin vertical bars: only the centre handle on top/bottom, full left/right. */
const VERTICAL_BAR_TYPES: ReadonlySet<string> = new Set(["activityForkNode", "StateForkNode"])
/** Thin horizontal bars: only the centre handle on left/right, full top/bottom. */
const HORIZONTAL_BAR_TYPES: ReadonlySet<string> = new Set([
  "activityForkNodeHorizontal",
  "StateForkNodeHorizontal",
])

export interface SideHandle {
  id: string
  fraction: number
}

/**
 * The two extra (non-visible, but connectable) handles `DefaultNodeWrapper`
 * renders on every side at 35% / 65%, in side order.
 */
const MID_HANDLES: Record<HandleSide, readonly [string, string]> = {
  top: ["top-mid-left", "top-mid-right"],
  bottom: ["bottom-mid-left", "bottom-mid-right"],
  left: ["left-mid-top", "left-mid-bottom"],
  right: ["right-mid-top", "right-mid-bottom"],
}

/**
 * The handles a node of `type` exposes on `side`, ordered along the side.
 * With `crowded` (more edge ends on the side than visible handles), a full
 * side also offers its two hidden mid handles so ends don't have to share.
 */
export const getSideHandles = (
  type: string | undefined,
  side: HandleSide,
  crowded = false
): SideHandle[] => {
  const all = SIDE_HANDLES[side].map((id, i) => ({ id, fraction: SIDE_FRACTIONS[i] }))
  const centreOnly = [all[1]]
  const [midA, midB] = MID_HANDLES[side]
  const five = [all[0], { id: midA, fraction: 0.35 }, all[1], { id: midB, fraction: 0.65 }, all[2]]
  const full = crowded ? five : all
  if (!type) return full
  if (CENTRE_HANDLE_TYPES.has(type)) return centreOnly
  if (VERTICAL_BAR_TYPES.has(type)) return side === "top" || side === "bottom" ? centreOnly : full
  if (HORIZONTAL_BAR_TYPES.has(type)) return side === "left" || side === "right" ? centreOnly : full
  return full
}

/** Absolute position of a handle on a node rectangle. Unknown ids fall back to the top centre. */
export const handlePoint = (rect: LayoutRect, handleId: string | null | undefined): LayoutPoint => {
  const geometry = (handleId && HANDLE_GEOMETRY[handleId]) || HANDLE_GEOMETRY.top
  return sidePoint(rect, geometry.side, geometry.fraction)
}

export const sidePoint = (rect: LayoutRect, side: HandleSide, fraction: number): LayoutPoint => {
  switch (side) {
    case "top":
      return { x: rect.x + rect.width * fraction, y: rect.y }
    case "bottom":
      return { x: rect.x + rect.width * fraction, y: rect.y + rect.height }
    case "left":
      return { x: rect.x, y: rect.y + rect.height * fraction }
    default:
      return { x: rect.x + rect.width, y: rect.y + rect.height * fraction }
  }
}

export const handleSide = (handleId: string | null | undefined): HandleSide | undefined =>
  handleId ? HANDLE_GEOMETRY[handleId]?.side : undefined

/**
 * Side + position along the side (0..1) of a stored handle id. Case-insensitive,
 * so converter spellings ("Right", "Top") resolve too; unknown ids → undefined.
 */
export const handleGeometry = (
  handleId: string | null | undefined
): { side: HandleSide; fraction: number } | undefined => {
  if (!handleId) return undefined
  return HANDLE_GEOMETRY[handleId] ?? HANDLE_GEOMETRY[handleId.toLowerCase()]
}

/**
 * Picks the facing side pair for an edge from the relative position of its two
 * endpoints, so a vertically stacked pair connects bottom→top (and a
 * side-by-side pair right→left) instead of wrapping around the boxes.
 */
export const chooseFacingSides = (
  sourceCenter: LayoutPoint,
  targetCenter: LayoutPoint
): { sourceSide: HandleSide; targetSide: HandleSide } => {
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? { sourceSide: "bottom", targetSide: "top" }
      : { sourceSide: "top", targetSide: "bottom" }
  }
  return dx >= 0
    ? { sourceSide: "right", targetSide: "left" }
    : { sourceSide: "left", targetSide: "right" }
}

/**
 * Facing sides for two rectangles: prefers the axis along which the boxes are
 * actually separated (so two boxes side by side but vertically offset still
 * connect left/right when there is a horizontal gap between them).
 */
export const chooseFacingSidesForRects = (
  source: LayoutRect,
  target: LayoutRect
): { sourceSide: HandleSide; targetSide: HandleSide } => {
  const gapX = Math.max(target.x - (source.x + source.width), source.x - (target.x + target.width))
  const gapY = Math.max(target.y - (source.y + source.height), source.y - (target.y + target.height))
  const sc = { x: source.x + source.width / 2, y: source.y + source.height / 2 }
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
  if (gapY >= 20 && gapY >= gapX) {
    return tc.y >= sc.y
      ? { sourceSide: "bottom", targetSide: "top" }
      : { sourceSide: "top", targetSide: "bottom" }
  }
  if (gapX >= 20) {
    return tc.x >= sc.x
      ? { sourceSide: "right", targetSide: "left" }
      : { sourceSide: "left", targetSide: "right" }
  }
  // Close boxes separated along one axis only: use that axis (a stack only a
  // few px apart that overlaps sideways connects bottom → top, not around).
  if (gapY > 0 && gapX <= 0) {
    return tc.y >= sc.y
      ? { sourceSide: "bottom", targetSide: "top" }
      : { sourceSide: "top", targetSide: "bottom" }
  }
  if (gapX > 0 && gapY <= 0) {
    return tc.x >= sc.x
      ? { sourceSide: "right", targetSide: "left" }
      : { sourceSide: "left", targetSide: "right" }
  }
  return chooseFacingSides(sc, tc)
}

/** Coordinate of a point along a side's axis (x for top/bottom, y for left/right). */
export const alongSide = (side: HandleSide, p: LayoutPoint): number =>
  side === "top" || side === "bottom" ? p.x : p.y

/**
 * Assigns ordered edge ends (by their desired coordinate along the side) to
 * the side's handles. With no more ends than handles every end gets its own
 * handle, preserving order and minimising the total displacement (small DP);
 * otherwise each end takes the nearest handle (order is preserved because
 * "nearest" is monotone).
 */
export const assignEndsToHandles = (
  desired: number[],
  handlePositions: number[]
): number[] => {
  const n = desired.length
  const m = handlePositions.length
  if (n === 0) return []
  if (m === 0) return desired.map(() => -1)
  const nearest = (v: number) => {
    let best = 0
    for (let k = 1; k < m; k++) {
      if (Math.abs(handlePositions[k] - v) < Math.abs(handlePositions[best] - v)) best = k
    }
    return best
  }
  if (n > m || m === 1) return desired.map(nearest)
  // dp[i][k]: min cost placing the first i ends using handles < k, end i-1 at handle k-1.
  const INF = Number.POSITIVE_INFINITY
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF))
  const choice: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-1))
  for (let k = 0; k <= m; k++) cost[0][k] = 0
  for (let i = 1; i <= n; i++) {
    for (let k = i; k <= m; k++) {
      // option 1: handle k-1 unused for end i-1 → same as cost[i][k-1]
      if (cost[i][k - 1] < cost[i][k]) {
        cost[i][k] = cost[i][k - 1]
        choice[i][k] = choice[i][k - 1]
      }
      // option 2: end i-1 takes handle k-1
      const c = cost[i - 1][k - 1] + Math.abs(desired[i - 1] - handlePositions[k - 1])
      if (c < cost[i][k]) {
        cost[i][k] = c
        choice[i][k] = k - 1
      }
    }
  }
  const out = new Array<number>(n).fill(0)
  let k = m
  for (let i = n; i >= 1; i--) {
    const h = choice[i][k]
    out[i - 1] = h
    k = h
  }
  return out
}
