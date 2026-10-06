import { useCallback } from "react"
import { useReactFlow, type InternalNode } from "@xyflow/react"
import { useDiagramStoreApi } from "@/store/context"
import type { IPoint } from "@/edges/Connection"
import type { FloatingEdgeLayout } from "@/utils/floatingEdges"
import type { LayoutRect } from "@/utils/autoLayoutHandles"
import {
  distanceToBorder,
  facingHandleIds,
  nearestBorderPort,
  portPoint,
  routeBetweenPorts,
  sideHandleId,
  sideTowards,
  type PortSide,
  type PortSpec,
} from "@/utils/edgePorts"
import { canConnectEndpoints } from "@/utils/bpmnConstraints"

/** Distance from a node outline within which a dropped endpoint is pinned. */
export const PORT_BAND = 12

const rectOf = (n: InternalNode): LayoutRect => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  width: n.measured.width ?? n.width ?? 0,
  height: n.measured.height ?? n.height ?? 0,
})

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

  /** Topmost node whose outline band or body contains `p`. */
  const nodeAt = useCallback(
    (p: IPoint): { id: string; rect: LayoutRect; onBorder: boolean } | null => {
      let hit: { id: string; rect: LayoutRect; onBorder: boolean; area: number } | null = null
      for (const node of getNodes()) {
        if (node.hidden) continue
        const internal = getInternalNode(node.id)
        if (!internal) continue
        const rect = rectOf(internal)
        const inside =
          p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height
        const nearBorder = distanceToBorder(rect, p) <= PORT_BAND
        if (!inside && !nearBorder) continue
        // Prefer the smallest hit (a class over the package containing it).
        const area = rect.width * rect.height
        if (!hit || area <= hit.area) hit = { id: node.id, rect, onBorder: nearBorder, area }
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
      const fixedPoint = { x: fixedEnd.x, y: fixedEnd.y }
      isReconnectingRef.current = true
      let drop: { nodeId: string; port?: PortSpec; rect: LayoutRect } | null = null

      const obstacles = () =>
        getNodes()
          .map((n) => getInternalNode(n.id))
          .filter((n): n is InternalNode => !!n && !n.hidden)
          .map(rectOf)

      const onMove = (ev: PointerEvent) => {
        const p = screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
        const hit = nodeAt(p)
        drop = hit
          ? { nodeId: hit.id, rect: hit.rect, port: hit.onBorder ? nearestBorderPort(hit.rect, p) : undefined }
          : null
        let end: { point: IPoint; side: PortSide } | null = null
        if (hit) {
          if (drop?.port) {
            end = { point: portPoint(hit.rect, drop.port), side: drop.port.side }
          } else {
            const side = sideTowards(hit.rect, fixedPoint) ?? "top"
            end = { point: portPoint(hit.rect, { side, t: 0.5 }), side }
          }
        }
        let pts: IPoint[]
        if (end) {
          pts =
            endType === "source"
              ? routeBetweenPorts(end.point, end.side, fixedPoint, fixedEnd.side, hit!.rect, fixedRect, obstacles())
              : routeBetweenPorts(fixedPoint, fixedEnd.side, end.point, end.side, fixedRect, hit!.rect, obstacles())
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
        const d = drop as { nodeId: string; port?: PortSpec; rect: LayoutRect } | null
        if (!d) return
        const { nodes, edges, setEdges } = storeApi.getState()
        const currentNodeId = endType === "source" ? source : target
        const reconnecting = d.nodeId !== currentNodeId
        const newSource = endType === "source" ? d.nodeId : source
        const newTarget = endType === "target" ? d.nodeId : target
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
            const handle = d.port
              ? sideHandleId(d.port.side)
              : endType === "source"
                ? facingHandleIds(d.rect, fixedRect).sourceHandle
                : facingHandleIds(fixedRect, d.rect).targetHandle
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
