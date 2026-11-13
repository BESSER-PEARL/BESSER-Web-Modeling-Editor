/**
 * Small orthogonal edge router for layouts whose node positions are fixed
 * before routing (BPMN lanes after band stacking, message flows between
 * pools, the "compact" auto-layout strategy).
 *
 * Classic "orthogonal visibility grid + A*" approach:
 *  - every obstacle is inflated by `margin`; the grid lines are the inflated
 *    obstacle borders, the port stub coordinates and the centre lines of the
 *    free channels between them;
 *  - a route leaves its source port perpendicular to the port's side (stub),
 *    walks the grid avoiding the inside of inflated obstacles, and enters the
 *    target port perpendicular to its side;
 *  - the cost is length + a penalty per bend + a penalty for running along a
 *    segment an earlier route already uses and for crossing an earlier route,
 *    so edges spread out instead of stacking on top of each other.
 *
 * Pure (no DOM), deterministic, dependency-free; sized for editor diagrams
 * (tens to a few hundred nodes).
 */

export interface RouterPoint {
  x: number
  y: number
}

export interface RouterRect {
  x: number
  y: number
  width: number
  height: number
}

export type RouterSide = "top" | "bottom" | "left" | "right"

export interface RouteEnd {
  /** Attachment point on the node border (absolute coordinates). */
  point: RouterPoint
  /** Side of the node the point sits on — the route leaves/enters perpendicular to it. */
  side: RouterSide
}

export interface RouteRequest {
  id: string
  source: RouteEnd
  target: RouteEnd
}

export interface RouterOptions {
  /** Clearance kept between routes and obstacles. */
  margin?: number
  /** Cost of one bend, in px of extra length. */
  bendPenalty?: number
  /** Cost multiplier for running along a segment another route already uses. */
  overlapPenalty?: number
  /** Cost of crossing another route. */
  crossingPenalty?: number
}

// Direction indices: 0 = +x, 1 = -x, 2 = +y, 3 = -y.
const DX = [1, -1, 0, 0]
const DY = [0, 0, 1, -1]
const OPPOSITE = [1, 0, 3, 2]

const sideDirection = (side: RouterSide): number =>
  side === "right" ? 0 : side === "left" ? 1 : side === "bottom" ? 2 : 3

const uniqueSorted = (values: number[]): number[] => {
  const sorted = [...values].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > 0.5) out.push(v)
  }
  return out
}

/** Index of the first value >= v - 0.5 (lower bound with tolerance). */
const lowerBound = (arr: number[], v: number): number => {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] < v - 0.5) lo = mid + 1
    else hi = mid
  }
  return lo
}

const indexOf = (arr: number[], v: number): number => {
  const i = lowerBound(arr, v)
  return i < arr.length && Math.abs(arr[i] - v) <= 0.5 ? i : -1
}

class MinHeap {
  private keys: number[] = []
  private vals: number[] = []
  get size() {
    return this.keys.length
  }
  get topKey() {
    return this.keys[0]
  }
  push(key: number, val: number) {
    const k = this.keys
    const v = this.vals
    k.push(key)
    v.push(val)
    let i = k.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (k[p] <= k[i]) break
      ;[k[p], k[i]] = [k[i], k[p]]
      ;[v[p], v[i]] = [v[i], v[p]]
      i = p
    }
  }
  pop(): number {
    const k = this.keys
    const v = this.vals
    const top = v[0]
    const lastK = k.pop()!
    const lastV = v.pop()!
    if (k.length > 0) {
      k[0] = lastK
      v[0] = lastV
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < k.length && k[l] < k[m]) m = l
        if (r < k.length && k[r] < k[m]) m = r
        if (m === i) break
        ;[k[m], k[i]] = [k[i], k[m]]
        ;[v[m], v[i]] = [v[i], v[m]]
        i = m
      }
    }
    return top
  }
}

/**
 * Uniform-grid spatial index of boxes, so "what is near this box" costs the
 * few cells it covers instead of a scan of every box. Ids are small integers;
 * a query visits each id once, in ascending order.
 */
export class GridIndex {
  private cells = new Map<number, number[]>()
  /** Boxes too large to bucket: returned by every query. */
  private big: number[] = []
  private seen: Uint32Array = new Uint32Array(64)
  private stampValue = 0
  constructor(private readonly cell = 128) {}

  private key(cx: number, cy: number) {
    return (cx + 32768) * 65536 + (cy + 32768)
  }

  private range(v0: number, v1: number): [number, number] {
    return [Math.floor(v0 / this.cell), Math.floor(v1 / this.cell)]
  }

  insert(id: number, x0: number, y0: number, x1: number, y1: number) {
    if (![x0, y0, x1, y1].every(Number.isFinite)) return
    if (id >= this.seen.length) {
      const grown = new Uint32Array(Math.max(id + 1, this.seen.length * 2))
      grown.set(this.seen)
      this.seen = grown
    }
    const [cx0, cx1] = this.range(Math.min(x0, x1), Math.max(x0, x1))
    const [cy0, cy1] = this.range(Math.min(y0, y1), Math.max(y0, y1))
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 4096) {
      this.big.push(id)
      return
    }
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = this.key(cx, cy)
        const list = this.cells.get(k)
        if (list) list.push(id)
        else this.cells.set(k, [id])
      }
    }
  }

  /** Ids of the boxes whose cells overlap the query box (a superset of the hits). */
  query(x0: number, y0: number, x1: number, y1: number): number[] {
    const out: number[] = []
    if (![x0, y0, x1, y1].every(Number.isFinite)) return out
    this.stampValue++
    const [cx0, cx1] = this.range(Math.min(x0, x1), Math.max(x0, x1))
    const [cy0, cy1] = this.range(Math.min(y0, y1), Math.max(y0, y1))
    const visit = (list: number[]) => {
      for (const id of list) {
        if (this.seen[id] === this.stampValue) continue
        this.seen[id] = this.stampValue
        out.push(id)
      }
    }
    visit(this.big)
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > this.cells.size) {
      for (const list of this.cells.values()) visit(list)
    } else {
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cy = cy0; cy <= cy1; cy++) {
          const list = this.cells.get(this.key(cx, cy))
          if (list) visit(list)
        }
      }
    }
    return out.sort((a, b) => a - b)
  }
}

/** Drops duplicate and collinear interior points of an orthogonal polyline. */
export const simplifyOrthogonal = (points: RouterPoint[]): RouterPoint[] => {
  const dedup: RouterPoint[] = []
  for (const p of points) {
    const last = dedup[dedup.length - 1]
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) {
      dedup.push(p)
    }
  }
  if (dedup.length <= 2) return dedup
  const out: RouterPoint[] = [dedup[0]]
  for (let i = 1; i < dedup.length - 1; i++) {
    const a = out[out.length - 1]
    const b = dedup[i]
    const c = dedup[i + 1]
    const collinear =
      (Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) ||
      (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01)
    if (!collinear) out.push(b)
  }
  out.push(dedup[dedup.length - 1])
  return out
}

/** Fallback when the grid search fails: a simple Z/L-shaped orthogonal route. */
const fallbackRoute = (req: RouteRequest, stub: number): RouterPoint[] => {
  const s = req.source.point
  const t = req.target.point
  const sd = sideDirection(req.source.side)
  const td = sideDirection(req.target.side)
  const s1 = { x: s.x + DX[sd] * stub, y: s.y + DY[sd] * stub }
  const t1 = { x: t.x + DX[td] * stub, y: t.y + DY[td] * stub }
  const horizontalStart = sd < 2
  const mid = horizontalStart
    ? [{ x: (s1.x + t1.x) / 2, y: s1.y }, { x: (s1.x + t1.x) / 2, y: t1.y }]
    : [{ x: s1.x, y: (s1.y + t1.y) / 2 }, { x: t1.x, y: (s1.y + t1.y) / 2 }]
  return simplifyOrthogonal([s, s1, ...mid, t1, t])
}

/** Moves the run of grid points leading out of a port onto the port's axis line. */
const snapRun = (path: RouterPoint[], side: RouterSide, port: RouterPoint, fromEnd: boolean) => {
  if (path.length === 0) return
  const key: "x" | "y" = side === "left" || side === "right" ? "y" : "x"
  const first = fromEnd ? path.length - 1 : 0
  const v = path[first][key]
  if (v === port[key] || Math.abs(v - port[key]) > 0.5) return
  const step = fromEnd ? -1 : 1
  let k = first
  while (k >= 0 && k < path.length && path[k][key] === v) k += step
  // One straight run between both ports: nothing to snap against.
  if (k < 0 || k >= path.length) return
  for (let m = first; m !== k; m += step) path[m] = { ...path[m], [key]: port[key] }
}

/**
 * Routes every request orthogonally around the obstacles. Returns, per
 * request id, the full polyline from the source point to the target point
 * (absolute coordinates, collinear points removed).
 */
export const routeOrthogonalEdges = (
  obstacles: RouterRect[],
  requests: RouteRequest[],
  options: RouterOptions = {}
): Map<string, RouterPoint[]> => routeAll(obstacles, requests, options, true)

/** How far (px) around the two port stubs a route is first searched for. */
const SEARCH_PAD = 200

/** Clearance below which a failed search is not retried with less clearance. */
const MIN_RETRY_MARGIN = 3

/** Without `fallback`, requests the grid search cannot route are left out. */
const routeAll = (
  obstacles: RouterRect[],
  requests: RouteRequest[],
  options: RouterOptions,
  fallback: boolean
): Map<string, RouterPoint[]> => {
  const margin = options.margin ?? 14
  const bendPenalty = options.bendPenalty ?? 40
  const overlapPenalty = options.overlapPenalty ?? 3
  const crossingPenalty = options.crossingPenalty ?? 30
  const result = new Map<string, RouterPoint[]>()
  if (requests.length === 0) return result

  const inflated = obstacles.map((r) => ({
    x0: r.x - margin,
    y0: r.y - margin,
    x1: r.x + r.width + margin,
    y1: r.y + r.height + margin,
  }))

  const stubOf = (end: RouteEnd): RouterPoint => {
    const d = sideDirection(end.side)
    return { x: end.point.x + DX[d] * margin, y: end.point.y + DY[d] * margin }
  }

  // --- grid coordinates -------------------------------------------------
  const rawX: number[] = []
  const rawY: number[] = []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const r of inflated) {
    rawX.push(r.x0, r.x1)
    rawY.push(r.y0, r.y1)
    minX = Math.min(minX, r.x0)
    minY = Math.min(minY, r.y0)
    maxX = Math.max(maxX, r.x1)
    maxY = Math.max(maxY, r.y1)
  }
  for (const req of requests) {
    for (const end of [req.source, req.target]) {
      const s = stubOf(end)
      rawX.push(s.x)
      rawY.push(s.y)
      minX = Math.min(minX, s.x)
      minY = Math.min(minY, s.y)
      maxX = Math.max(maxX, s.x)
      maxY = Math.max(maxY, s.y)
    }
  }
  rawX.push(minX - margin * 2, maxX + margin * 2)
  rawY.push(minY - margin * 2, maxY + margin * 2)
  const withChannels = (values: number[]): number[] => {
    const base = uniqueSorted(values)
    const mids: number[] = []
    for (let i = 0; i + 1 < base.length; i++) {
      if (base[i + 1] - base[i] > margin) mids.push((base[i] + base[i + 1]) / 2)
    }
    return uniqueSorted([...base, ...mids])
  }
  let xs = withChannels(rawX)
  let ys = withChannels(rawY)
  if (xs.length * ys.length > 250_000) {
    xs = uniqueSorted(rawX)
    ys = uniqueSorted(rawY)
  }
  const W = xs.length
  const H = ys.length
  const nodeIndex = (i: number, j: number) => j * W + i

  // --- blocked cells / segments ----------------------------------------
  // A grid point is blocked when strictly inside an inflated obstacle; a
  // segment between neighbouring grid points is blocked when its midpoint is.
  const blockedNode = new Uint8Array(W * H)
  const blockedH = new Uint8Array(W * H) // segment (i,j)-(i+1,j)
  const blockedV = new Uint8Array(W * H) // segment (i,j)-(i,j+1)
  for (const r of inflated) {
    const i0 = lowerBound(xs, r.x0)
    const j0 = lowerBound(ys, r.y0)
    for (let j = j0; j < H && ys[j] <= r.y1 + 0.5; j++) {
      const insideY = ys[j] > r.y0 + 0.5 && ys[j] < r.y1 - 0.5
      for (let i = i0; i < W && xs[i] <= r.x1 + 0.5; i++) {
        const insideX = xs[i] > r.x0 + 0.5 && xs[i] < r.x1 - 0.5
        const n = nodeIndex(i, j)
        if (insideX && insideY) blockedNode[n] = 1
        // horizontal segment to i+1: midpoint strictly inside?
        if (insideY && i + 1 < W && xs[i + 1] <= r.x1 + 0.5 && xs[i] >= r.x0 - 0.5) {
          const mx = (xs[i] + xs[i + 1]) / 2
          if (mx > r.x0 && mx < r.x1) blockedH[n] = 1
        }
        if (insideX && j + 1 < H && ys[j + 1] <= r.y1 + 0.5 && ys[j] >= r.y0 - 0.5) {
          const my = (ys[j] + ys[j + 1]) / 2
          if (my > r.y0 && my < r.y1) blockedV[n] = 1
        }
      }
    }
  }

  // Usage by already-routed edges.
  const usedH = new Uint16Array(W * H)
  const usedV = new Uint16Array(W * H)
  const passH = new Uint8Array(W * H) // a route runs horizontally through this point
  const passV = new Uint8Array(W * H)

  const order = requests
    .map((r, k) => ({
      r,
      k,
      d:
        Math.abs(r.source.point.x - r.target.point.x) +
        Math.abs(r.source.point.y - r.target.point.y),
    }))
    .sort((a, b) => a.d - b.d || a.k - b.k)

  // Search state per (grid point, arrival direction). `stamp` marks the
  // entries the current request wrote, so nothing is re-filled per request.
  const STATES = W * H * 4
  const gScore = new Float64Array(STATES)
  const cameFrom = new Int32Array(STATES)
  const stamp = new Uint32Array(STATES)
  let gen = 0

  for (const { r: req } of order) {
    const s = req.source.point
    const t = req.target.point
    const sStub = stubOf(req.source)
    const tStub = stubOf(req.target)
    const si = indexOf(xs, sStub.x)
    const sj = indexOf(ys, sStub.y)
    const ti = indexOf(xs, tStub.x)
    const tj = indexOf(ys, tStub.y)
    const startDir = sideDirection(req.source.side)
    // Arrival direction at the target stub that continues straight into the port.
    const entryDir = OPPOSITE[sideDirection(req.target.side)]
    if (si < 0 || sj < 0 || ti < 0 || tj < 0) {
      result.set(req.id, fallbackRoute(req, margin))
      continue
    }
    const startNode = nodeIndex(si, sj)
    const goalNode = nodeIndex(ti, tj)

    // Remaining length + the bends any path from (i, j) heading `d` still
    // needs (admissible and consistent, so the search stays exact).
    const h = (i: number, j: number, d: number) => {
      const di = ti - i
      const dj = tj - j
      const along = d < 2 ? di : dj
      const across = d < 2 ? dj : di
      const ahead = along === 0 ? 0 : Math.sign(along) === (d === 0 || d === 2 ? 1 : -1) ? 1 : -1
      const turns = across === 0 ? (ahead >= 0 ? 0 : 2) : ahead >= 0 ? 1 : 2
      return Math.abs(xs[i] - xs[ti]) + Math.abs(ys[j] - ys[tj]) + turns * bendPenalty
    }
    const startState = startNode * 4 + startDir
    /** A* within grid columns i0..i1 and rows j0..j1; the best goal state or -1. */
    const search = (i0: number, i1: number, j0: number, j1: number): number => {
      gen++
      const heap = new MinHeap()
      gScore[startState] = 0
      cameFrom[startState] = -1
      stamp[startState] = gen
      heap.push(h(si, sj, startDir), startState)
      let bestGoal = -1
      let bestGoalCost = Infinity

      while (heap.size > 0) {
        const key = heap.topKey
        const state = heap.pop()
        const node = state >> 2
        const dir = state & 3
        const g = gScore[state]
        const i = node % W
        const j = (node - i) / W
        // Stale entry: the state was reached more cheaply after this push.
        if (key > g + h(i, j, dir) + 1e-6) continue
        // Keys are lower bounds of the full cost: nothing left can beat the best.
        if (key >= bestGoalCost) break
        if (node === goalNode) {
          const finalCost = g + (dir === entryDir ? 0 : dir === OPPOSITE[entryDir] ? Infinity : bendPenalty)
          if (finalCost < bestGoalCost) {
            bestGoalCost = finalCost
            bestGoal = state
          }
          continue
        }
        for (let nd = 0; nd < 4; nd++) {
          if (nd === OPPOSITE[dir]) continue
          const ni = i + DX[nd]
          const nj = j + DY[nd]
          if (ni < i0 || nj < j0 || ni > i1 || nj > j1) continue
          const next = nodeIndex(ni, nj)
          if (blockedNode[next] && next !== goalNode) continue
          const segBlocked =
            nd === 0 ? blockedH[node] : nd === 1 ? blockedH[next] : nd === 2 ? blockedV[node] : blockedV[next]
          if (segBlocked) continue
          const len = nd < 2 ? Math.abs(xs[ni] - xs[i]) : Math.abs(ys[nj] - ys[j])
          const used = nd === 0 ? usedH[node] : nd === 1 ? usedH[next] : nd === 2 ? usedV[node] : usedV[next]
          let cost = len * (1 + used * overlapPenalty)
          if (nd !== dir) cost += bendPenalty
          // crossing an earlier route perpendicular at the next point
          if (nd < 2 ? passV[next] : passH[next]) cost += crossingPenalty
          const ns = next * 4 + nd
          const ng = g + cost
          if (stamp[ns] !== gen || ng < gScore[ns]) {
            stamp[ns] = gen
            gScore[ns] = ng
            cameFrom[ns] = state
            heap.push(ng + h(ni, nj, nd), ns)
          }
        }
      }
      return bestGoal
    }

    // Search near the two ends first (keeps long batches fast); the whole
    // grid only when no route exists within that window.
    const i0 = lowerBound(xs, Math.min(sStub.x, tStub.x) - SEARCH_PAD)
    const i1 = lowerBound(xs, Math.max(sStub.x, tStub.x) + SEARCH_PAD + 1) - 1
    const j0 = lowerBound(ys, Math.min(sStub.y, tStub.y) - SEARCH_PAD)
    const j1 = lowerBound(ys, Math.max(sStub.y, tStub.y) + SEARCH_PAD + 1) - 1
    let bestGoal = search(i0, i1, j0, j1)
    if (bestGoal < 0 && (i0 > 0 || j0 > 0 || i1 < W - 1 || j1 < H - 1)) bestGoal = search(0, W - 1, 0, H - 1)

    if (bestGoal < 0) {
      // Usually a port stub inside a close neighbour's clearance (gap < 2 x
      // margin): retry this route with half the clearance before giving up.
      const retry =
        margin / 2 >= MIN_RETRY_MARGIN
          ? routeAll(obstacles, [req], { ...options, margin: margin / 2 }, false).get(req.id)
          : undefined
      if (retry) result.set(req.id, retry)
      else if (fallback) result.set(req.id, fallbackRoute(req, margin))
      continue
    }
    const gridPath: RouterPoint[] = []
    const states: number[] = []
    for (let st = bestGoal; st >= 0; st = cameFrom[st]) {
      states.push(st)
      if (st === startState) break
    }
    states.reverse()
    for (const st of states) {
      const node = st >> 2
      const i = node % W
      const j = (node - i) / W
      gridPath.push({ x: xs[i], y: ys[j] })
    }
    // Mark usage.
    for (let k = 0; k + 1 < states.length; k++) {
      const a = states[k] >> 2
      const b = states[k + 1] >> 2
      const nd = states[k + 1] & 3
      if (nd === 0) usedH[a]++
      else if (nd === 1) usedH[b]++
      else if (nd === 2) usedV[a]++
      else usedV[b]++
      if (nd < 2) {
        passH[a] = 1
        passH[b] = 1
      } else {
        passV[a] = 1
        passV[b] = 1
      }
    }
    // Grid lines closer than 0.5 px are merged: put the stub runs back on the
    // exact port coordinate so the first / last segment is not slanted.
    snapRun(gridPath, req.source.side, s, false)
    snapRun(gridPath, req.target.side, t, true)
    result.set(req.id, simplifyOrthogonal([{ ...s }, ...gridPath, { ...t }]))
  }
  return result
}
