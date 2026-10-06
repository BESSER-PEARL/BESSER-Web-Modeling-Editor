import { useCallback, useMemo, useEffect, useRef, useState } from "react"
import { getSmoothStepPath, useReactFlow } from "@xyflow/react"
import { log } from "../logger"
import { EDGES } from "@/constants"
import {
  adjustSourceCoordinates,
  adjustTargetCoordinates,
  getPositionOnCanvas,
} from "@/utils"
import { Position } from "@xyflow/react"
import {
  IPoint,
  pointsToSvgPath,
  tryFindStraightPath,
} from "../edges/Connection"
import { useDiagramStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import {
  getEdgeMarkerStyles,
  simplifySvgPath,
  removeDuplicatePoints,
  parseSvgPath,
  calculateInnerMidpoints,
  getMarkerSegmentPath,
} from "@/utils/edgeUtils"
import { useEdgeState, useEdgeReconnection } from "../edges/GenericEdge"
import { useDiagramModifiable } from "./useDiagramModifiable"
import { useHandleFinder } from "./useHandleFinder"
import type { FloatingEdgeLayout } from "@/utils/floatingEdges"
import {
  dragSegment,
  segmentHandles,
  trimRouteEnds,
  PORT_CLEARANCE,
} from "@/utils/edgeDragging"
import { useFloatingEndpointDrag } from "./useFloatingEndpointDrag"

interface UseStepPathEdgeProps {
  id: string
  type: string
  source: string
  target: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  sourceHandleId?: string | null
  targetHandleId?: string | null
  data?: { points?: IPoint[] }
  allowMidpointDragging?: boolean
  enableReconnection?: boolean
  enableStraightPath?: boolean
  /**
   * Continuous-port geometry (class diagrams): the route, ports and sides
   * come from here instead of React Flow's handle positions.
   */
  floating?: FloatingEdgeLayout
}

export interface StepPathEdgeData {
  activePoints: IPoint[]
  pathMiddlePosition: IPoint
  isMiddlePathHorizontal: boolean
  sourcePoint: IPoint
  targetPoint: IPoint
}

export const useStepPathEdge = ({
  id,
  type,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  data,
  allowMidpointDragging = true,
  enableReconnection = true,
  enableStraightPath = false,
  floating,
}: UseStepPathEdgeProps) => {
  // Floating edges attach where their geometry says, not at the RF handle.
  if (floating) {
    sourcePosition = floating.source.side as Position
    targetPosition = floating.target.side as Position
  }
  const draggingIndexRef = useRef<number | null>(null)
  const dragOffsetRef = useRef<IPoint>({ x: 0, y: 0 })
  const pathRef = useRef<SVGPathElement | null>(null)
  const finalPointsRef = useRef<IPoint[]>([])
  const dragPointsRef = useRef<IPoint[]>([])

  const isDiagramModifiable = useDiagramModifiable()
  const { getNode, getNodes, screenToFlowPosition, getInternalNode } =
    useReactFlow()

  const [pathMiddlePosition, setPathMiddlePosition] = useState<IPoint>({
    x: (sourceX + targetX) / 2,
    y: (sourceY + targetY) / 2,
  })
  const [isMiddlePathHorizontal, setIsMiddlePathHorizontal] =
    useState<boolean>(true)
  const [hasInitialCalculation, setHasInitialCalculation] = useState(false)

  const {
    customPoints,
    setCustomPoints,
    tempReconnectPoints,
    setTempReconnectPoints,
  } = useEdgeState(data?.points)
  const {
    isReconnectingRef,
    reconnectingEndRef,
    startReconnection,
    completeReconnection,
  } = useEdgeReconnection(id, source, target, sourceHandleId, targetHandleId)

  const { findBestHandle } = useHandleFinder()
  const { setEdges } = useDiagramStore(
    useShallow((state) => ({
      setEdges: state.setEdges,
    }))
  )

  const {
    markerPadding,
    markerEnd,
    markerStart,
    strokeDashArray,
    offset = 0,
  } = getEdgeMarkerStyles(type)
  const padding = markerPadding ?? EDGES.MARKER_PADDING
  const sourceNode = getNode(source)!
  const targetNode = getNode(target)!
  const allNodes = getNodes()

  const sourceAbsolutePosition = useMemo(() => {
    if (!sourceNode) return { x: sourceX, y: sourceY }
    return getPositionOnCanvas(sourceNode, allNodes)
  }, [sourceNode, allNodes, sourceX, sourceY])

  const targetAbsolutePosition = useMemo(() => {
    if (!targetNode) return { x: targetX, y: targetY }
    return getPositionOnCanvas(targetNode, allNodes)
  }, [targetNode, allNodes, targetX, targetY])
  // Round coordinates to whole pixels for pixel-perfect rendering
  // React Flow may return fractional values when node dimensions are odd
  const roundedSourceX = Math.round(sourceX)
  const roundedSourceY = Math.round(sourceY)
  const roundedTargetX = Math.round(targetX)
  const roundedTargetY = Math.round(targetY)

  const adjustedTargetCoordinates = adjustTargetCoordinates(
    roundedTargetX,
    roundedTargetY,
    targetPosition,
    padding
  )
  const adjustedSourceCoordinates = adjustSourceCoordinates(
    roundedSourceX,
    roundedSourceY,
    sourcePosition,
    EDGES.SOURCE_CONNECTION_POINT_PADDING
  )
  const basePath = useMemo(() => {
    if (!enableStraightPath) {
      const [edgePath] = getSmoothStepPath({
        sourceX: adjustedSourceCoordinates.sourceX,
        sourceY: adjustedSourceCoordinates.sourceY,
        sourcePosition,
        targetX: adjustedTargetCoordinates.targetX,
        targetY: adjustedTargetCoordinates.targetY,
        targetPosition,
        borderRadius: EDGES.STEP_BORDER_RADIUS,
        offset: 30,
      })
      return edgePath
    }

    const straightPathPoints = tryFindStraightPath(
      {
        position: { x: sourceAbsolutePosition.x, y: sourceAbsolutePosition.y },
        width: sourceNode.width ?? 100,
        height: sourceNode.height ?? 160,
        direction: sourcePosition,
      },
      {
        position: { x: targetAbsolutePosition.x, y: targetAbsolutePosition.y },
        width: targetNode.width ?? 100,
        height: targetNode.height ?? 160,
        direction: targetPosition,
      },
      padding,
      {
        sourceX: roundedSourceX,
        sourceY: roundedSourceY,
        targetX: roundedTargetX,
        targetY: roundedTargetY,
      }
    )

    if (straightPathPoints !== null) {
      return pointsToSvgPath(straightPathPoints)
    } else {
      const [edgePath] = getSmoothStepPath({
        sourceX: adjustedSourceCoordinates.sourceX,
        sourceY: adjustedSourceCoordinates.sourceY,
        sourcePosition,
        targetX: adjustedTargetCoordinates.targetX,
        targetY: adjustedTargetCoordinates.targetY,
        targetPosition,
        borderRadius: EDGES.STEP_BORDER_RADIUS,
        offset: 30,
      })
      return edgePath
    }
  }, [
    enableStraightPath,
    sourceAbsolutePosition,
    targetAbsolutePosition,
    sourceNode,
    targetNode,
    sourcePosition,
    targetPosition,
    sourceX,
    sourceY,
    targetX,
    targetY,
    padding,
  ])

  const computedPoints = useMemo(() => {
    const simplifiedPath = simplifySvgPath(basePath)
    const parsed = parseSvgPath(simplifiedPath)
    const result = removeDuplicatePoints(parsed)
    return result
  }, [basePath])

  const prevNodePositionsRef = useRef<{
    source: { x: number; y: number; parentId?: string }
    target: { x: number; y: number; parentId?: string }
  }>({
    source: {
      x: sourceAbsolutePosition.x,
      y: sourceAbsolutePosition.y,
      parentId: sourceNode.parentId,
    },
    target: {
      x: targetAbsolutePosition.x,
      y: targetAbsolutePosition.y,
      parentId: targetNode.parentId,
    },
  })

  const lastSeenPointsRef = useRef<IPoint[] | undefined>(data?.points)

  // Reset custom points when nodes move. Compares ABSOLUTE (canvas)
  // positions: a node inside a container that moves (BPMN pool / lane,
  // package, …) keeps its relative `position`, but its route must follow.
  useEffect(() => {
    const currentSourcePos = {
      x: sourceAbsolutePosition.x,
      y: sourceAbsolutePosition.y,
      parentId: sourceNode.parentId,
    }
    const currentTargetPos = {
      x: targetAbsolutePosition.x,
      y: targetAbsolutePosition.y,
      parentId: targetNode.parentId,
    }
    const prevSourcePos = prevNodePositionsRef.current.source
    const prevTargetPos = prevNodePositionsRef.current.target

    const sourceChanged =
      currentSourcePos.x !== prevSourcePos.x ||
      currentSourcePos.y !== prevSourcePos.y ||
      currentSourcePos.parentId !== prevSourcePos.parentId

    const targetChanged =
      currentTargetPos.x !== prevTargetPos.x ||
      currentTargetPos.y !== prevTargetPos.y ||
      currentTargetPos.parentId !== prevTargetPos.parentId

    if (sourceChanged || targetChanged) {
      prevNodePositionsRef.current = {
        source: currentSourcePos,
        target: currentTargetPos,
      }

      // The stored route was replaced in the same update as the node move
      // (auto-layout, undo/redo, remote sync): it already matches the new
      // geometry, so adopt it instead of shifting/clearing the old one.
      if (data?.points !== lastSeenPointsRef.current) {
        lastSeenPointsRef.current = data?.points
        setCustomPoints(data?.points ?? [])
        return
      }

      if (customPoints.length > 0) {
        if (sourceChanged && targetChanged) {
          const deltaX = currentSourcePos.x - prevSourcePos.x
          const deltaY = currentSourcePos.y - prevSourcePos.y
          // Route points are flow coordinates: translate them directly
          // (running them through screenToFlowPosition skewed the route by
          // the viewport pan/zoom).
          const newPoints = customPoints.map((point) => ({
            x: point.x + deltaX,
            y: point.y + deltaY,
          }))

          setCustomPoints(newPoints)
          setEdges((edges) =>
            edges.map((edge) =>
              edge.id === id
                ? {
                    ...edge,
                    data: { ...edge.data, points: newPoints },
                  }
                : edge
            )
          )
        } else {
          setCustomPoints([])
          setEdges((edges) =>
            edges.map((edge) =>
              edge.id === id
                ? {
                    ...edge,
                    data: { ...edge.data, points: undefined },
                  }
                : edge
            )
          )
        }
      }
    }
  }, [
    sourceAbsolutePosition.x,
    sourceAbsolutePosition.y,
    sourceNode.parentId,
    targetAbsolutePosition.x,
    targetAbsolutePosition.y,
    targetNode.parentId,
    customPoints,
    id,
    setEdges,
    setCustomPoints,
    data?.points,
  ])

  // Declared after the move effect on purpose: that effect compares against
  // the previous value to detect a route replaced together with a move.
  useEffect(() => {
    lastSeenPointsRef.current = data?.points
  }, [data?.points])

  const activePoints = useMemo(() => {
    if (floating) return tempReconnectPoints ?? floating.points
    let points: IPoint[]
    if (tempReconnectPoints) {
      points = tempReconnectPoints
    } else if (data?.points && data.points.length > 0) {
      points = data.points
    } else {
      points = customPoints.length ? customPoints : computedPoints
    }

    // Always ensure first and last points use adjusted coordinates
    // This handles stale stored points when nodes have moved
    if (points.length >= 2) {
      const adjustedFirst = {
        x: adjustedSourceCoordinates.sourceX,
        y: adjustedSourceCoordinates.sourceY,
      }
      const adjustedLast = {
        x: adjustedTargetCoordinates.targetX,
        y: adjustedTargetCoordinates.targetY,
      }
      // Only update if significantly different (more than 1px) to avoid unnecessary re-renders
      const firstDiff =
        Math.abs(points[0].x - adjustedFirst.x) > 1 ||
        Math.abs(points[0].y - adjustedFirst.y) > 1
      const lastDiff =
        Math.abs(points[points.length - 1].x - adjustedLast.x) > 1 ||
        Math.abs(points[points.length - 1].y - adjustedLast.y) > 1

      if (firstDiff || lastDiff) {
        points = [...points]
        if (firstDiff) {
          points[0] = adjustedFirst
        }
        if (lastDiff) {
          points[points.length - 1] = adjustedLast
        }
      }
    }

    return points
  }, [
    floating,
    customPoints,
    computedPoints,
    tempReconnectPoints,
    data?.points,
    adjustedSourceCoordinates.sourceX,
    adjustedSourceCoordinates.sourceY,
    adjustedTargetCoordinates.targetX,
    adjustedTargetCoordinates.targetY,
  ])

  const currentPath = useMemo(() => {
    return pointsToSvgPath(activePoints)
  }, [activePoints])

  const markerSegmentPath = useMemo(
    () => getMarkerSegmentPath(activePoints, offset, targetPosition),
    [activePoints, offset, targetPosition]
  )

  const overlayPath = useMemo(() => {
    // Floating: keep the interaction stroke off the last px at each end so
    // the node's port band under an attached edge can still start a new one.
    if (floating) return pointsToSvgPath(trimRouteEnds(activePoints, PORT_CLEARANCE))
    return `${currentPath} ${markerSegmentPath}`
  }, [currentPath, markerSegmentPath, floating, activePoints])

  const midpoints = useMemo(() => {
    if (!allowMidpointDragging) return []
    // Floating: every segment can be dragged (first / last slide the port).
    if (floating) return segmentHandles(activePoints)
    if (activePoints.length < 3) return []
    return calculateInnerMidpoints(activePoints)
  }, [activePoints, allowMidpointDragging, floating])

  useEffect(() => {
    if (pathRef.current && currentPath) {
      const calculateMiddlePoint = () => {
        if (!pathRef.current) return

        try {
          const totalLength = pathRef.current.getTotalLength()

          if (totalLength > 0) {
            const halfLength = totalLength / 2
            const middlePoint = pathRef.current.getPointAtLength(halfLength)
            const pointOnCloseToMiddle = pathRef.current.getPointAtLength(
              halfLength + 2
            )

            const isHorizontal =
              Math.abs(pointOnCloseToMiddle.x - middlePoint.x) >
              Math.abs(pointOnCloseToMiddle.y - middlePoint.y)

            setIsMiddlePathHorizontal(isHorizontal)
            setPathMiddlePosition({ x: middlePoint.x, y: middlePoint.y })

            if (!hasInitialCalculation) {
              setHasInitialCalculation(true)
            }
          }
        } catch (error) {
          log.warn("Path calculation error:", error)
          setPathMiddlePosition({
            x: (sourceX + targetX) / 2,
            y: (sourceY + targetY) / 2,
          })
        }
      }
      const timeoutId = setTimeout(calculateMiddlePoint, 0)

      return () => clearTimeout(timeoutId)
    }
  }, [currentPath, sourceX, sourceY, targetX, targetY, hasInitialCalculation])

  /**
   * Floating segment drag: the route stays orthogonal, first / last segments
   * slide (and pin) their port, snapping onto a neighbour removes bends.
   * Previewed on the DOM, written to the store once on release.
   */
  const handleFloatingSegmentDown = useCallback(
    (event: React.PointerEvent, index: number) => {
      if (!floating || !isDiagramModifiable) return
      event.stopPropagation()
      const start = [...activePoints]
      const handle = segmentHandles(start).find((h) => h.index === index)
      if (!handle) return
      const sourceInternal = getInternalNode(source)
      const targetInternal = getInternalNode(target)
      if (!sourceInternal || !targetInternal) return
      const rectOf = (n: typeof sourceInternal) => ({
        x: n.internals.positionAbsolute.x,
        y: n.internals.positionAbsolute.y,
        width: n.measured.width ?? n.width ?? 0,
        height: n.measured.height ?? n.height ?? 0,
      })
      const ctx = {
        sourceRect: rectOf(sourceInternal),
        targetRect: rectOf(targetInternal),
        sourceSide: floating.source.side,
        targetSide: floating.target.side,
      }
      const circleEl = event.target as SVGCircleElement
      const container = circleEl.closest(".edge-container")
      const mainPath = container?.querySelector(
        ".react-flow__edge-path"
      ) as SVGPathElement | null
      const overlay = container?.querySelector(
        ".edge-overlay"
      ) as SVGPathElement | null
      container?.classList.add("edge-container--dragging")
      let result: ReturnType<typeof dragSegment> | null = null

      const onMove = (e: PointerEvent) => {
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        result = dragSegment(start, index, handle.horizontal ? p.y : p.x, ctx)
        const d = pointsToSvgPath(result.preview)
        mainPath?.setAttribute("d", d)
        overlay?.setAttribute("d", d)
        const movedIndex = result.movedIndex
        const mid = segmentHandles(result.preview).find(
          (h) => h.index === movedIndex
        )
        if (mid) {
          const group = circleEl.closest(".edge-segment-handle")
          const circles = group ? group.querySelectorAll("circle") : [circleEl]
          circles.forEach((c) => {
            c.setAttribute("cx", String(mid.x))
            c.setAttribute("cy", String(mid.y))
          })
        }
      }
      const onUp = () => {
        document.removeEventListener("pointermove", onMove)
        container?.classList.remove("edge-container--dragging")
        const r = result as ReturnType<typeof dragSegment> | null
        if (!r) return
        setCustomPoints(r.storedPoints)
        setEdges((eds) =>
          eds.map((edge) => {
            if (edge.id !== id) return edge
            const nextData: Record<string, unknown> = {
              ...edge.data,
              points: r.storedPoints,
            }
            if (r.sourcePort) nextData.sourcePort = r.sourcePort
            if (r.targetPort) nextData.targetPort = r.targetPort
            return { ...edge, data: nextData }
          })
        )
      }
      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp, { once: true })
    },
    [
      floating,
      isDiagramModifiable,
      activePoints,
      getInternalNode,
      source,
      target,
      screenToFlowPosition,
      setCustomPoints,
      setEdges,
      id,
    ]
  )

  const handleFloatingEndpointDown = useFloatingEndpointDrag({
    id,
    source,
    target,
    floating,
    isReconnectingRef,
    setTempReconnectPoints,
  })

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, index: number) => {
      if (!allowMidpointDragging) return
      if (floating) {
        handleFloatingSegmentDown(event, index)
        return
      }

      // Store initial state
      const currentMidpoint = midpoints[index]
      draggingIndexRef.current = index
      dragOffsetRef.current = {
        x: event.clientX - currentMidpoint.x,
        y: event.clientY - currentMidpoint.y,
      }
      dragPointsRef.current = [...activePoints]

      // Get DOM elements for direct manipulation (like React Flow does for nodes)
      const circleEl = event.target as SVGCircleElement
      const container = circleEl.closest(".edge-container")
      const mainPath = container?.querySelector(
        ".react-flow__edge-path"
      ) as SVGPathElement | null
      const overlayPath = container?.querySelector(
        ".edge-overlay"
      ) as SVGPathElement | null

      const handlePointerMove = (e: PointerEvent) => {
        if (draggingIndexRef.current === null) return

        const idx = draggingIndexRef.current
        const newX = e.clientX - dragOffsetRef.current.x
        const newY = e.clientY - dragOffsetRef.current.y

        // Determine if this segment is horizontal or vertical
        const pts = dragPointsRef.current
        const isVertical = Math.abs(pts[idx + 1].x - pts[idx + 2].x) < 1

        // Update the two points that define this segment
        const newPoints = [...pts]
        if (isVertical) {
          newPoints[idx + 1] = { x: newX, y: pts[idx + 1].y }
          newPoints[idx + 2] = { x: newX, y: pts[idx + 2].y }
        } else {
          newPoints[idx + 1] = { x: pts[idx + 1].x, y: newY }
          newPoints[idx + 2] = { x: pts[idx + 2].x, y: newY }
        }
        dragPointsRef.current = newPoints
        finalPointsRef.current = newPoints

        // Direct DOM updates for instant feedback
        const pathD = pointsToSvgPath(newPoints)
        mainPath?.setAttribute("d", pathD)
        overlayPath?.setAttribute(
          "d",
          `${pathD} ${getMarkerSegmentPath(newPoints, offset, targetPosition)}`
        )

        // Update circle position
        const mids = calculateInnerMidpoints(newPoints)
        if (mids[idx]) {
          circleEl.setAttribute("cx", String(mids[idx].x))
          circleEl.setAttribute("cy", String(mids[idx].y))
        }
      }

      const handlePointerUp = () => {
        // Sync to React state only on release
        setCustomPoints(finalPointsRef.current)
        setEdges((eds) =>
          eds.map((e) =>
            e.id === id
              ? { ...e, data: { ...e.data, points: finalPointsRef.current } }
              : e
          )
        )
        draggingIndexRef.current = null
        document.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("pointerup", handlePointerUp)
      }

      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp, { once: true })
    },
    [
      midpoints,
      activePoints,
      id,
      setEdges,
      allowMidpointDragging,
      setCustomPoints,
      offset,
      targetPosition,
      floating,
      handleFloatingSegmentDown,
    ]
  )

  const handleEndpointPointerDown = useCallback(
    (e: React.PointerEvent, endType: "source" | "target") => {
      if (!isDiagramModifiable || !enableReconnection) return
      if (floating) {
        handleFloatingEndpointDown(e, endType)
        return
      }

      const endpoint =
        endType === "source"
          ? activePoints[0]
          : activePoints[activePoints.length - 1]

      startReconnection(e, endType, endpoint)

      const handleEndpointPointerMove = (moveEvent: PointerEvent) => {
        if (!isReconnectingRef.current) return

        const newEndpoint = screenToFlowPosition({
          x: moveEvent.clientX,
          y: moveEvent.clientY,
        })

        let newSourceX = sourceX
        let newSourceY = sourceY
        let newTargetX = targetX
        let newTargetY = targetY

        if (reconnectingEndRef.current === "source") {
          newSourceX = newEndpoint.x
          newSourceY = newEndpoint.y
        } else {
          newTargetX = newEndpoint.x
          newTargetY = newEndpoint.y
        }
        const isActivityDiagram = type.startsWith("Activity")

        let newPoints: IPoint[] = []

        if (isActivityDiagram) {
          const adjustedTargetCoordinates = adjustTargetCoordinates(
            newTargetX,
            newTargetY,
            targetPosition,
            padding
          )
          const adjustedSourceCoordinates = adjustSourceCoordinates(
            newSourceX,
            newSourceY,
            sourcePosition,
            EDGES.SOURCE_CONNECTION_POINT_PADDING
          )

          const [edgePath] = getSmoothStepPath({
            sourceX: adjustedSourceCoordinates.sourceX,
            sourceY: adjustedSourceCoordinates.sourceY,
            sourcePosition,
            targetX: adjustedTargetCoordinates.targetX,
            targetY: adjustedTargetCoordinates.targetY,
            targetPosition,
            borderRadius: EDGES.STEP_BORDER_RADIUS,
            offset: 30,
          })

          const simplifiedPath = simplifySvgPath(edgePath)
          newPoints = removeDuplicatePoints(parseSvgPath(simplifiedPath))
        } else {
          const newSourceAbsolute =
            reconnectingEndRef.current === "source"
              ? newEndpoint
              : sourceAbsolutePosition
          const newTargetAbsolute =
            reconnectingEndRef.current === "target"
              ? newEndpoint
              : targetAbsolutePosition

          const straightPathPoints = tryFindStraightPath(
            {
              position: { x: newSourceAbsolute.x, y: newSourceAbsolute.y },
              width: sourceNode.width ?? 100,
              height: sourceNode.height ?? 160,
              direction: sourcePosition,
            },
            {
              position: { x: newTargetAbsolute.x, y: newTargetAbsolute.y },
              width: targetNode.width ?? 100,
              height: targetNode.height ?? 160,
              direction: targetPosition,
            },
            padding,
            {
              sourceX: Math.round(newSourceX),
              sourceY: Math.round(newSourceY),
              targetX: Math.round(newTargetX),
              targetY: Math.round(newTargetY),
            }
          )

          if (straightPathPoints !== null) {
            newPoints = straightPathPoints
          } else {
            const adjustedTargetCoordinates = adjustTargetCoordinates(
              newTargetX,
              newTargetY,
              targetPosition,
              padding
            )
            const adjustedSourceCoordinates = adjustSourceCoordinates(
              newSourceX,
              newSourceY,
              sourcePosition,
              EDGES.SOURCE_CONNECTION_POINT_PADDING
            )

            const [edgePath] = getSmoothStepPath({
              sourceX: adjustedSourceCoordinates.sourceX,
              sourceY: adjustedSourceCoordinates.sourceY,
              sourcePosition,
              targetX: adjustedTargetCoordinates.targetX,
              targetY: adjustedTargetCoordinates.targetY,
              targetPosition,
              borderRadius: EDGES.STEP_BORDER_RADIUS,
              offset: 30,
            })
            const simplifiedPath = simplifySvgPath(edgePath)
            newPoints = removeDuplicatePoints(parseSvgPath(simplifiedPath))
          }
        }

        setTempReconnectPoints(newPoints)
      }

      const handleEndpointPointerUp = (upEvent: PointerEvent) => {
        setTempReconnectPoints(null)
        document.removeEventListener("pointermove", handleEndpointPointerMove, {
          capture: true,
        })
        document.removeEventListener("pointerup", handleEndpointPointerUp, {
          capture: true,
        })

        completeReconnection(upEvent, findBestHandle, () => {
          setCustomPoints([])
        })
      }

      document.addEventListener("pointermove", handleEndpointPointerMove, {
        capture: true,
      })
      document.addEventListener("pointerup", handleEndpointPointerUp, {
        once: true,
        capture: true,
      })
    },
    [
      isDiagramModifiable,
      enableReconnection,
      activePoints,
      startReconnection,
      isReconnectingRef,
      screenToFlowPosition,
      reconnectingEndRef,
      setTempReconnectPoints,
      completeReconnection,
      setCustomPoints,
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      type,
      padding,
      sourceAbsolutePosition,
      targetAbsolutePosition,
      sourceNode,
      targetNode,
      findBestHandle,
      floating,
      handleFloatingEndpointDown,
    ]
  )

  const sourcePoint = activePoints[0] || { x: sourceX, y: sourceY }
  const targetPoint = activePoints[activePoints.length - 1] || {
    x: targetX,
    y: targetY,
  }

  const edgeData: StepPathEdgeData = {
    activePoints,
    pathMiddlePosition,
    isMiddlePathHorizontal,
    sourcePoint,
    targetPoint,
  }

  return {
    pathRef,
    edgeData,
    currentPath,
    overlayPath,
    midpoints,
    hasInitialCalculation,
    isReconnectingRef,
    markerEnd,
    markerStart,
    strokeDashArray,
    handlePointerDown,
    handleEndpointPointerDown,
    sourcePoint,
    targetPoint,
    isDiagramModifiable,
  }
}
