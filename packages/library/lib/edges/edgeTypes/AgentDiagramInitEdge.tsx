import { BaseEdge, getBezierPath } from "@xyflow/react"
import { curveEnds, getCurvedPath } from "../curvedPath"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import {
  BaseEdgeProps,
  EdgeEndpointMarkers,
  CommonEdgeElements,
} from "../GenericEdge"
import { useEdgeConfig } from "@/hooks/useEdgeConfig"
import { DiagramEdgeType } from "@/edges"
import { useStepPathEdge } from "@/hooks/useStepPathEdge"
import { useFloatingEdgeLayout } from "@/hooks/useFloatingEdges"
import { useDiagramStore, usePopoverStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { useToolbar } from "@/hooks"
import { EDGES } from "@/constants"
import { FeedbackDropzone } from "@/components/wrapper/FeedbackDropzone"
import { AssessmentSelectableWrapper } from "@/components/wrapper/AssessmentSelectableWrapper"
import { getCustomColorsFromDataForEdge } from "@/utils/layoutUtils"
import { EdgeInlineMarkers } from "@/components/svgs/edges/InlineMarker"
import { registerEdgeTypes } from "../types"

/**
 * `AgentStateTransitionInit` edge — initial-state marker. v3 source:
 * `agent-state-diagram/agent-state-transition-init/`. The edge has no
 * source element (or a synthetic source) and points at the initial
 * state. Edge `data: { initial: true }` (plus `points`).
 *
 * No label, no trigger semantics — purely a visual marker. Inspector
 * exposes nothing beyond the marker flag itself.
 */
export const AgentDiagramInitEdge = ({
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
  selected,
}: BaseEdgeProps) => {
  const [anchorEl, anchorRef] =
    usePopoverAnchor<SVGForeignObjectElement>()
  const { handleDelete } = useToolbar({ id })

  const config = useEdgeConfig(type as DiagramEdgeType)
  const allowMidpointDragging =
    "allowMidpointDragging" in config ? config.allowMidpointDragging : true

  const { assessments } = useDiagramStore(
    useShallow((state) => ({
      assessments: state.assessments,
    }))
  )

  const setPopOverElementId = usePopoverStore(
    useShallow((state) => state.setPopOverElementId)
  )

  // Continuous ports: anchors and route computed from the node outlines.
  const floating = useFloatingEdgeLayout(id)

  const {
    pathRef,
    edgeData,
    hasInitialCalculation,
    isReconnectingRef,
    markerEnd,
    markerStart,
    strokeDashArray,
    handleEndpointPointerDown,
    sourcePoint,
    targetPoint,
    isDiagramModifiable,
  } = useStepPathEdge({
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
    allowMidpointDragging,
    enableReconnection: true,
    enableStraightPath: false,
    floating,
  })

  const { strokeColor } = getCustomColorsFromDataForEdge(data)
  // Classic React Flow bézier stroke (native "flow" edge) — no UML right angles.
  const [smoothPath] = floating
    ? [getCurvedPath(curveEnds(edgeData.activePoints, floating, source === target)).path]
    : getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      })
  const markerKey = `${id}-${markerStart ?? "none"}-${markerEnd ?? "none"}`

  return (
    <AssessmentSelectableWrapper elementId={id} asElement="g">
      <FeedbackDropzone elementId={id} asElement="path" elementType={type}>
        <g className="edge-container">
          <BaseEdge
            key={markerKey}
            id={id}
            path={smoothPath}
            pointerEvents="none"
            // `.edge-overlay` is the interaction stroke (trimmed at the ends
            // for floating edges); React Flow's own would cover the ports.
            interactionWidth={floating ? 0 : undefined}
            style={{
              stroke: strokeColor,
              strokeDasharray: isReconnectingRef.current
                ? "none"
                : strokeDashArray,
              transition: hasInitialCalculation
                ? "opacity 0.1s ease-in"
                : "none",
              opacity: 1,
            }}
          />

          {!isReconnectingRef.current && (
            <EdgeInlineMarkers
              pathD={smoothPath}
              markerEnd={markerEnd}
              markerStart={markerStart}
              strokeColor={strokeColor}
            />
          )}

          <path
            ref={pathRef}
            className="edge-overlay"
            d={smoothPath}
            fill="none"
            strokeWidth={EDGES.EDGE_HIGHLIGHT_STROKE_WIDTH}
            pointerEvents="stroke"
            style={{ opacity: isReconnectingRef.current ? 0 : 0.4 }}
          />

          <EdgeEndpointMarkers
            sourcePoint={sourcePoint}
            targetPoint={targetPoint}
            isDiagramModifiable={isDiagramModifiable}
            selected={selected}
            diagramType="step"
            pathType="step"
            showDots={!!floating}
            onSourcePointerDown={(e) => handleEndpointPointerDown(e, "source")}
            onTargetPointerDown={(e) => handleEndpointPointerDown(e, "target")}
          />

        </g>

        <CommonEdgeElements
          id={id}
          pathMiddlePosition={edgeData.pathMiddlePosition}
          isDiagramModifiable={isDiagramModifiable}
          assessments={assessments}
          anchorRef={anchorRef}
          anchorEl={anchorEl}
          handleDelete={handleDelete}
          setPopOverElementId={setPopOverElementId}
          type={type}
        />
      </FeedbackDropzone>
    </AssessmentSelectableWrapper>
  )
}

// Side-effect registration.
registerEdgeTypes({ AgentStateTransitionInit: AgentDiagramInitEdge })
