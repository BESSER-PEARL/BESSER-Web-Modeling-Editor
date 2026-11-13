import {
  useStore,
  type ConnectionLineComponentProps,
  type InternalNode,
} from "@xyflow/react"
import type { IPoint } from "./Connection"
import { pointsToSvgPath } from "./Connection"
import { routeBetweenPorts } from "@/utils/edgePorts"
import { chooseFacingSidesForRects, type LayoutRect } from "@/utils/autoLayoutHandles"
import { NO_PORT_NODE_TYPES, nearestOutlinePort, portFrame, portOutlinePoint } from "@/utils/nodeShapes"
import { simplifyOrthogonal } from "@/utils/orthogonalRouter"

/**
 * Where the current connection drag started (flow coordinates), recorded by
 * the node wrapper on pointer-down in a node's port band.
 */
let connectStart: { nodeId: string; point: IPoint } | null = null
export const setConnectStart = (value: typeof connectStart) => {
  connectStart = value
}
export const getConnectStart = () => connectStart

const rectOf = (n: InternalNode): LayoutRect => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  width: n.measured.width ?? n.width ?? 0,
  height: n.measured.height ?? n.height ?? 0,
})

/**
 * Connection preview for continuous ports: starts where the drag started on
 * the source outline; over a target node it shows where the edge will attach
 * (the facing sides of both nodes, on their real outlines).
 */
export const FloatingConnectionLine = ({
  fromNode,
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) => {
  const nodeLookup = useStore((s) => s.nodeLookup)
  const from = portFrame(fromNode.type, rectOf(fromNode))
  const fromRect = from.box
  const startPoint =
    connectStart && connectStart.nodeId === fromNode.id ? connectStart.point : { x: fromX, y: fromY }
  const grabPort = nearestOutlinePort(from.shape, fromRect, startPoint)

  // Smallest node under the pointer (a class over its package).
  let over: { node: InternalNode; rect: LayoutRect; area: number } | null = null
  for (const node of nodeLookup.values()) {
    if (node.hidden || node.id === fromNode.id || NO_PORT_NODE_TYPES.has(node.type ?? "")) continue
    const r = rectOf(node)
    if (toX < r.x || toX > r.x + r.width || toY < r.y || toY > r.y + r.height) continue
    const area = r.width * r.height
    if (!over || area < over.area) over = { node, rect: r, area }
  }

  let points: IPoint[]
  let start = portOutlinePoint(from.shape, fromRect, grabPort)
  let end: IPoint = { x: toX, y: toY }
  if (over) {
    const to = portFrame(over.node.type, over.rect)
    const { sourceSide, targetSide } = chooseFacingSidesForRects(fromRect, to.box)
    const s = portOutlinePoint({ kind: "rect" }, fromRect, { side: sourceSide, t: 0.5 })
    const t = portOutlinePoint({ kind: "rect" }, to.box, { side: targetSide, t: 0.5 })
    start = portOutlinePoint(from.shape, fromRect, { side: sourceSide, t: 0.5 })
    end = portOutlinePoint(to.shape, to.box, { side: targetSide, t: 0.5 })
    points = simplifyOrthogonal([start, ...routeBetweenPorts(s, sourceSide, t, targetSide, fromRect, to.box, []), end])
  } else {
    const horizontal = grabPort.side === "left" || grabPort.side === "right"
    points = [start, horizontal ? { x: toX, y: start.y } : { x: start.x, y: toY }, end]
  }

  return (
    <g className="besser-connection-preview">
      <path className="react-flow__connection-path" fill="none" d={pointsToSvgPath(points)} />
      <circle className="besser-connection-preview__start" cx={start.x} cy={start.y} r={4} />
      {over && <circle className="besser-connection-preview__end" cx={end.x} cy={end.y} r={4} />}
    </g>
  )
}
