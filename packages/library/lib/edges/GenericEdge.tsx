import { useRef, useState, useEffect } from "react"
import { useReactFlow, type Node } from "@xyflow/react"
import { ExtendedEdgeProps } from "./EdgeProps"
import { CustomEdgeToolbar } from "@/components"
import { IPoint } from "./Connection"
import { useReconnect } from "@/hooks/useReconnect"
import { PopoverManager } from "@/components/popovers/PopoverManager"
import AssessmentIcon from "@/components/svgs/AssessmentIcon"
import { DiagramEdgeType } from "."
import { Assessment } from "@/typings"

export interface BaseEdgeProps extends ExtendedEdgeProps {
  diagramType?: "class" | "usecase" | "activity" | "component" | "deployment"
}
export const useEdgeState = (initialPoints?: IPoint[]) => {
  const [customPoints, setCustomPoints] = useState<IPoint[]>([])
  const [tempReconnectPoints, setTempReconnectPoints] = useState<
    IPoint[] | null
  >(null)

  useEffect(() => {
    if (initialPoints && initialPoints.length > 0) {
      setCustomPoints(initialPoints)
    }
  }, [initialPoints])

  return {
    customPoints,
    setCustomPoints,
    tempReconnectPoints,
    setTempReconnectPoints,
  }
}

export const useEdgeReconnection = (
  id: string,
  source: string,
  target: string,
  sourceHandleId?: string | null,
  targetHandleId?: string | null
) => {
  const isReconnectingRef = useRef<boolean>(false)
  const reconnectOffsetRef = useRef<IPoint>({ x: 0, y: 0 })
  const reconnectingEndRef = useRef<"source" | "target" | null>(null)
  const onReconnect = useReconnect()
  const { getEdges } = useReactFlow()

  const startReconnection = (
    e: React.PointerEvent,
    endType: "source" | "target",
    currentPoint: IPoint
  ) => {
    e.stopPropagation()
    e.preventDefault()

    isReconnectingRef.current = true
    reconnectingEndRef.current = endType

    reconnectOffsetRef.current = {
      x: e.clientX - currentPoint.x,
      y: e.clientY - currentPoint.y,
    }
  }

  const completeReconnection = (
    upEvent: PointerEvent,
    handleFinder: (upEvent: PointerEvent) => {
      handle: string | null
      node: Node | null
      shouldClearPoints: boolean
    },
    onCustomPointsClear?: () => void
  ) => {
    const isReconnectingSource = reconnectingEndRef.current === "source"
    isReconnectingRef.current = false

    const { handle, node, shouldClearPoints } = handleFinder(upEvent)

    if (!node || shouldClearPoints) {
      reconnectingEndRef.current = null
      onCustomPointsClear?.()
      return
    }

    const newConnection = isReconnectingSource
      ? {
          source: node.id,
          target: target,
          sourceHandle: handle,
          targetHandle: targetHandleId ?? null,
        }
      : {
          source: source,
          target: node.id,
          sourceHandle: sourceHandleId ?? null,
          targetHandle: handle,
        }

    const oldEdge = getEdges().find((edge) => edge.id === id)
    if (oldEdge) {
      onReconnect(oldEdge, newConnection)
    }

    onCustomPointsClear?.()
    reconnectingEndRef.current = null
  }

  return {
    isReconnectingRef,
    reconnectingEndRef,
    startReconnection,
    completeReconnection,
  }
}

export const EdgeEndpointMarkers = ({
  sourcePoint,
  targetPoint,
  isDiagramModifiable,
  selected,
  diagramType,
  pathType,
  onSourcePointerDown,
  onTargetPointerDown,
  showDots = false,
}: {
  sourcePoint: IPoint
  targetPoint: IPoint
  isDiagramModifiable: boolean
  selected?: boolean
  diagramType: string
  pathType: string
  onSourcePointerDown: (e: React.PointerEvent) => void
  onTargetPointerDown: (e: React.PointerEvent) => void
  /** Draw visible endpoint grips (floating edges). */
  showDots?: boolean
}) => {
  if (!isDiagramModifiable || diagramType === "usecase") return null

  // Only render grab circles when the edge is selected.
  // These circles sit in the edge SVG layer (z-index 9999) above node handles
  // (z-index 9998). When unselected, they would intercept pointer events
  // intended for node handles, preventing new edge creation from handles
  // that already have an edge connected.
  if (!selected) return null

  const hitRadius = showDots ? 7 : pathType === "straight" ? 8 : 10
  return (
    <>
      {showDots &&
        [sourcePoint, targetPoint].map((p, i) => (
          <circle
            key={i}
            className="besser-edge-endpoint-dot"
            cx={p.x}
            cy={p.y}
            r={4}
            pointerEvents="none"
          />
        ))}
      <circle
        className="besser-edge-endpoint-grab"
        cx={sourcePoint.x}
        cy={sourcePoint.y}
        r={hitRadius}
        fill="transparent"
        stroke="transparent"
        strokeWidth={0}
        pointerEvents="all"
        onPointerDown={onSourcePointerDown}
        style={{ cursor: "crosshair" }}
      />
      <circle
        className="target-edge-marker-grab besser-edge-endpoint-grab"
        cx={targetPoint.x}
        cy={targetPoint.y}
        r={hitRadius}
        fill="transparent"
        stroke="transparent"
        strokeWidth={0}
        pointerEvents="all"
        onPointerDown={onTargetPointerDown}
        style={{ cursor: "crosshair" }}
      />
    </>
  )
}

export const CommonEdgeElements = ({
  id,
  pathMiddlePosition,
  isDiagramModifiable,
  assessments,
  anchorRef,
  anchorEl,
  handleDelete,
  setPopOverElementId,
  type,
  onAttachAssociationClass,
}: {
  id: string
  pathMiddlePosition: IPoint
  isDiagramModifiable: boolean
  assessments: Record<string, Assessment>
  /** Callback ref for the toolbar anchor (see `usePopoverAnchor`). */
  anchorRef: React.Ref<SVGForeignObjectElement>
  /** The live anchor element the popover opens against. */
  anchorEl: Element | null
  handleDelete: () => void
  setPopOverElementId: (id: string) => void
  type: string
  /** Association-class authoring action (ClassDiagramEdge only). */
  onAttachAssociationClass?: () => void
}) => {
  const nodeScore = assessments[id]?.score

  return (
    <>
      <CustomEdgeToolbar
        edgeId={id}
        anchorRef={anchorRef}
        position={pathMiddlePosition}
        showEdit={true}
        onEditClick={() => setPopOverElementId(id)}
        onDeleteClick={handleDelete}
        onAttachAssociationClass={onAttachAssociationClass}
      />

      {!isDiagramModifiable && (
        <AssessmentIcon
          x={pathMiddlePosition.x - 15}
          y={pathMiddlePosition.y - 15}
          score={nodeScore}
        />
      )}

      <PopoverManager
        elementId={id}
        anchorEl={anchorEl}
        type={type as DiagramEdgeType}
      />
    </>
  )
}
