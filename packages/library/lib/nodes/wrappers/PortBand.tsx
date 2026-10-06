import { useEffect, useRef } from "react"
import { Handle, Position, useReactFlow, useStoreApi } from "@xyflow/react"
import { setConnectStart } from "@/edges/FloatingConnectionLine"
import { nearestBorderPort, portPoint } from "@/utils/edgePorts"

/** Port band thickness inside / outside the node outline (px, flow units). */
export const PORT_BAND_INSIDE = 7
export const PORT_BAND_OUTSIDE = 9

/** Id of the single connection handle of a continuous-port node. */
export const PORT_HANDLE_ID = "port"

/**
 * Continuous connection port of a node: an invisible band along the outline
 * (a few px inside and outside) that starts a connection from wherever it is
 * grabbed, plus one connector dot that follows the pointer along the nearest
 * border point while the node is hovered. The node body still drags the node;
 * on a selected node the resize controls sit above the band.
 */
export function PortBand({ elementId }: { elementId: string }) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const downAt = useRef<{ x: number; y: number } | null>(null)
  const { getInternalNode } = useReactFlow()
  const rfStore = useStoreApi()

  useEffect(() => {
    const nodeEl = anchorRef.current?.closest<HTMLElement>(".react-flow__node")
    const dot = dotRef.current
    if (!nodeEl || !dot) return
    /** Pointer position in node-local px (independent of zoom). */
    const local = (e: PointerEvent) => {
      const r = nodeEl.getBoundingClientRect()
      const scale = nodeEl.offsetWidth ? r.width / nodeEl.offsetWidth : 1
      return {
        x: (e.clientX - r.left) / scale,
        y: (e.clientY - r.top) / scale,
        w: nodeEl.offsetWidth,
        h: nodeEl.offsetHeight,
      }
    }
    const onMove = (e: PointerEvent) => {
      if (rfStore.getState().connection.inProgress) {
        dot.style.opacity = "0"
        return
      }
      const p = local(e)
      const rect = { x: 0, y: 0, width: p.w, height: p.h }
      const q = portPoint(rect, nearestBorderPort(rect, p))
      const inBand = Math.hypot(p.x - q.x, p.y - q.y) <= Math.max(PORT_BAND_INSIDE, PORT_BAND_OUTSIDE)
      dot.style.transform = `translate(${q.x}px, ${q.y}px)`
      dot.style.opacity = "1"
      dot.classList.toggle("besser-port-dot--hot", inBand)
    }
    const onLeave = () => {
      dot.style.opacity = "0"
    }
    nodeEl.addEventListener("pointermove", onMove)
    nodeEl.addEventListener("pointerleave", onLeave)
    return () => {
      nodeEl.removeEventListener("pointermove", onMove)
      nodeEl.removeEventListener("pointerleave", onLeave)
    }
  }, [rfStore])

  /** Records where on the outline the connection starts (preview origin). */
  const onPointerDown = (e: React.PointerEvent) => {
    downAt.current = { x: e.clientX, y: e.clientY }
    const internal = getInternalNode(elementId)
    const nodeEl = anchorRef.current?.closest<HTMLElement>(".react-flow__node")
    if (!internal || !nodeEl) return
    const r = nodeEl.getBoundingClientRect()
    const scale = nodeEl.offsetWidth ? r.width / nodeEl.offsetWidth : 1
    const rect = {
      x: internal.internals.positionAbsolute.x,
      y: internal.internals.positionAbsolute.y,
      width: nodeEl.offsetWidth,
      height: nodeEl.offsetHeight,
    }
    const p = {
      x: rect.x + (e.clientX - r.left) / scale,
      y: rect.y + (e.clientY - r.top) / scale,
    }
    setConnectStart({ nodeId: elementId, point: portPoint(rect, nearestBorderPort(rect, p)) })
  }

  /** A click (no drag) on the band selects the node like a click on its body. */
  const onClick = (e: React.MouseEvent) => {
    const d = downAt.current
    downAt.current = null
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
    const { addSelectedNodes, multiSelectionActive, nodeLookup } = rfStore.getState()
    if (!multiSelectionActive) {
      const others = [...nodeLookup.values()].filter((n) => n.selected && n.id !== elementId)
      if (others.length) rfStore.getState().unselectNodesAndEdges()
    }
    addSelectedNodes([elementId])
  }

  return (
    <>
      <div ref={anchorRef} className="besser-port-anchor" aria-hidden="true" />
      <Handle
        id={PORT_HANDLE_ID}
        type="source"
        position={Position.Top}
        className="besser-port-band"
        isConnectableStart
        isConnectableEnd
        onPointerDown={onPointerDown}
        onClick={onClick}
        style={{
          top: -PORT_BAND_OUTSIDE,
          left: -PORT_BAND_OUTSIDE,
          right: -PORT_BAND_OUTSIDE,
          bottom: -PORT_BAND_OUTSIDE,
          ["--besser-port-band" as string]: `${PORT_BAND_INSIDE + PORT_BAND_OUTSIDE}px`,
        }}
      >
        {/* `source`: React Flow reads the handle type off the element under
            the pointer when a connection starts. */}
        {(["top", "right", "bottom", "left"] as const).map((side) => (
          <div
            key={side}
            className={`besser-port-band__strip besser-port-band__strip--${side} source`}
          />
        ))}
      </Handle>
      <div ref={dotRef} className="besser-port-dot" aria-hidden="true" />
    </>
  )
}
