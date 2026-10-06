import {
  useStore,
  type ConnectionLineComponentProps,
  type InternalNode,
} from "@xyflow/react"
import type { IPoint } from "./Connection"
import { pointsToSvgPath } from "./Connection"
import { nearestBorderPort, portPoint, routeBetweenPorts } from "@/utils/edgePorts"
import { chooseFacingSidesForRects, type LayoutRect } from "@/utils/autoLayoutHandles"

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
 * (the facing sides of both nodes).
 */
export const FloatingConnectionLine = ({
  fromNode,
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) => {
  const nodeLookup = useStore((s) => s.nodeLookup)
  const fromRect = rectOf(fromNode)
  const startPoint =
    connectStart && connectStart.nodeId === fromNode.id ? connectStart.point : { x: fromX, y: fromY }
  const grabPort = nearestBorderPort(fromRect, startPoint)

  // Smallest node under the pointer (a class over its package).
  let over: { rect: LayoutRect; area: number } | null = null
  for (const node of nodeLookup.values()) {
    if (node.hidden || node.id === fromNode.id) continue
    const r = rectOf(node)
    if (toX < r.x || toX > r.x + r.width || toY < r.y || toY > r.y + r.height) continue
    const area = r.width * r.height
    if (!over || area < over.area) over = { rect: r, area }
  }

  let points: IPoint[]
  let start = portPoint(fromRect, grabPort)
  let end: IPoint = { x: toX, y: toY }
  if (over) {
    const { sourceSide, targetSide } = chooseFacingSidesForRects(fromRect, over.rect)
    start = portPoint(fromRect, { side: sourceSide, t: 0.5 })
    end = portPoint(over.rect, { side: targetSide, t: 0.5 })
    points = routeBetweenPorts(start, sourceSide, end, targetSide, fromRect, over.rect, [])
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
