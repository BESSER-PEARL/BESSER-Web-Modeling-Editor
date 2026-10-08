import { useCallback } from "react"
import { useReactFlow, type InternalNode } from "@xyflow/react"
import { useDiagramStoreApi } from "@/store/context"
import type { IPoint } from "@/edges/Connection"
import type { FloatingEdgeLayout } from "@/utils/floatingEdges"
import type { LayoutRect } from "@/utils/autoLayoutHandles"
import {
  facingHandleIds,
  routeBetweenPorts,
  sideHandleId,
  sideTowards,
  type PortSide,
  type PortSpec,
} from "@/utils/edgePorts"
import {
  distanceToOutline,
  NO_PORT_NODE_TYPES,
  nearestOutlinePort,
  portFrame,
  portOutlinePoint,
  ROUTE_TRANSPARENT_NODE_TYPES,
  type NodeShape,
} from "@/utils/nodeShapes"
import { simplifyOrthogonal } from "@/utils/orthogonalRouter"
import { canConnectEndpoints } from "@/utils/bpmnConstraints"
import { defaultFlagAfterSourceChange } from "@/utils/bpmnDefaultFlow"

/** Distance from a node outline within which a dropped endpoint is pinned. */
export const PORT_BAND = 12

const rectOf = (n: InternalNode): LayoutRect => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  width: n.measured.width ?? n.width ?? 0,
  height: n.measured.height ?? n.height ?? 0,
})

/** Point on the attachment box side straight out from an outline point. */
const onBoxSide = (box: LayoutRect, side: PortSide, p: IPoint): IPoint => {
  switch (side) {
    case "top":
      return { x: p.x, y: box.y }
    case "bottom":
      return { x: p.x, y: box.y + box.height }
    case "left":
      return { x: box.x, y: p.y }
    default:
      return { x: box.x + box.width, y: p.y }
  }
}

interface Hit {
  id: string
  /** Full bounding box. */
  rect: LayoutRect
  shape: NodeShape
  /** Attachment box (ports are on its sides). */
  box: LayoutRect
  onBorder: boolean
}

/**
 * Dragging a selected floating edge's endpoint: released on a node's outline
 * it pins there (`data.sourcePort` / `data.targetPort`); released on a node's
 * body it goes back to automatic; released on another node it reconnects.
 */
export const useFloatingEndpointDrag = ({
  id,
  source,
  target,
  floating,
  isReconnectingRef,
  setTempReconnectPoints,
}: {
  id: string
  source: string
  target: string
  floating?: FloatingEdgeLayout
  isReconnectingRef: React.MutableRefObject<boolean>
  setTempReconnectPoints: (points: IPoint[] | null) => void
}) => {
  const { screenToFlowPosition, getNodes, getInternalNode } = useReactFlow()
  const storeApi = useDiagramStoreApi()

  /**
   * Node under `p`: the one whose outline is nearest when `p` is on an
   * outline band (two close nodes: the one aimed at), otherwise the smallest
   * node whose body contains it (a class over the package containing it).
   */
  const nodeAt = useCallback(
    (p: IPoint): Hit | null => {
      let hit: (Hit & { area: number; dist: number }) | null = null
      for (const node of getNodes()) {
        // Member rows are part of their parent (which contains the point too).
        if (node.hidden || NO_PORT_NODE_TYPES.has(node.type ?? "")) continue
        const internal = getInternalNode(node.id)
        if (!internal) continue
        const rect = rectOf(internal)
        const { shape, box } = portFrame(node.type, rect)
        const inside =
          p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height
        const dist = distanceToOutline(shape, box, p)
        const nearBorder = dist <= PORT_BAND
        if (!inside && !nearBorder) continue
        const area = rect.width * rect.height
        const better =
          !hit ||
          (nearBorder && !hit.onBorder) ||
          (nearBorder && hit.onBorder && (dist < hit.dist - 0.5 || (Math.abs(dist - hit.dist) <= 0.5 && area <= hit.area))) ||
          (!nearBorder && !hit.onBorder && area <= hit.area)
        if (better) hit = { id: node.id, rect, shape, box, onBorder: nearBorder, area, dist }
      }
      return hit
    },
    [getNodes, getInternalNode]
  )

  return useCallback(
    (e: React.PointerEvent, endType: "source" | "target") => {
      if (!floating) return
      e.stopPropagation()
      e.preventDefault()
      const fixedEnd = endType === "source" ? floating.target : floating.source
      const fixedNodeId = endType === "source" ? target : source
      const fixedInternal = getInternalNode(fixedNodeId)
      if (!fixedInternal) return
      const fixedRect = rectOf(fixedInternal)
      const fixedBox = portFrame(fixedInternal.type, fixedRect).box
      const fixedPoint = { x: fixedEnd.x, y: fixedEnd.y }
      isReconnectingRef.current = true
      let drop: (Hit & { port?: PortSpec }) | null = null

      const obstacles = () =>
        getNodes()
          .filter((n) => !ROUTE_TRANSPARENT_NODE_TYPES.has(n.type ?? ""))
          .map((n) => getInternalNode(n.id))
          .filter((n): n is InternalNode => !!n && !n.hidden)
          .map(rectOf)

      const onMove = (ev: PointerEvent) => {
        const p = screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
        const hit = nodeAt(p)
        drop = hit ? { ...hit, port: hit.onBorder ? nearestOutlinePort(hit.shape, hit.box, p) : undefined } : null
        let pts: IPoint[]
        if (hit) {
          const port: PortSpec = drop?.port ?? { side: sideTowards(hit.box, fixedPoint) ?? "top", t: 0.5 }
          const endPoint = portOutlinePoint(hit.shape, hit.box, port)
          const endOnBox = onBoxSide(hit.box, port.side, endPoint)
          const fixedOnBox = onBoxSide(fixedBox, fixedEnd.side, fixedPoint)
          const route =
            endType === "source"
              ? routeBetweenPorts(endOnBox, port.side, fixedOnBox, fixedEnd.side, hit.box, fixedBox, obstacles())
              : routeBetweenPorts(fixedOnBox, fixedEnd.side, endOnBox, port.side, fixedBox, hit.box, obstacles())
          pts =
            endType === "source"
              ? simplifyOrthogonal([endPoint, ...route, fixedPoint])
              : simplifyOrthogonal([fixedPoint, ...route, endPoint])
        } else {
          const corner =
            fixedEnd.side === "left" || fixedEnd.side === "right"
              ? { x: p.x, y: fixedPoint.y }
              : { x: fixedPoint.x, y: p.y }
          pts = endType === "source" ? [p, corner, fixedPoint] : [fixedPoint, corner, p]
        }
        setTempReconnectPoints(pts)
      }

      const onUp = () => {
        document.removeEventListener("pointermove", onMove, { capture: true })
        isReconnectingRef.current = false
        setTempReconnectPoints(null)
        const d = drop as (Hit & { port?: PortSpec }) | null
        if (!d) return
        const { nodes, edges, setEdges } = storeApi.getState()
        const currentNodeId = endType === "source" ? source : target
        const reconnecting = d.id !== currentNodeId
        const newSource = endType === "source" ? d.id : source
        const newTarget = endType === "target" ? d.id : target
        if (reconnecting && !canConnectEndpoints(nodes, newSource, newTarget, undefined, edges)) return
        const portKey = endType === "source" ? "sourcePort" : "targetPort"
        const handleKey = endType === "source" ? "sourceHandle" : "targetHandle"
        setEdges((eds) =>
          eds.map((edge) => {
            if (edge.id !== id) return edge
            const data: Record<string, unknown> = { ...edge.data }
            if (d.port) data[portKey] = d.port
            else delete data[portKey]
            if (reconnecting) data.points = []
            // BPMN: a default flow moved onto a source that cannot carry a
            // default loses the flag (same rule as `useReconnect`).
            if (reconnecting && endType === "source" && data.isDefault) {
              const newSourceNode = nodes.find((n) => n.id === newSource)
              if (!defaultFlagAfterSourceChange(edge, newSourceNode)) data.isDefault = false
            }
            const handle = d.port
              ? sideHandleId(d.port.side)
              : endType === "source"
                ? facingHandleIds(d.box, fixedBox).sourceHandle
                : facingHandleIds(fixedBox, d.box).targetHandle
            return {
              ...edge,
              source: newSource,
              target: newTarget,
              [handleKey]: handle,
              data,
            }
          })
        )
      }

      document.addEventListener("pointermove", onMove, { capture: true })
      document.addEventListener("pointerup", onUp, { once: true, capture: true })
    },
    [
      floating,
      source,
      target,
      getInternalNode,
      getNodes,
      screenToFlowPosition,
      nodeAt,
      isReconnectingRef,
      setTempReconnectPoints,
      storeApi,
    ]
  )
}
