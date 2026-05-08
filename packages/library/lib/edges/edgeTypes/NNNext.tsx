import { BaseEdge } from "@xyflow/react"
import { useRef } from "react"
import {
  BaseEdgeProps,
  EdgeEndpointMarkers,
  CommonEdgeElements,
} from "../GenericEdge"
import { EdgeMiddleLabels } from "../labelTypes/EdgeMiddleLabels"
import { useEdgeConfig } from "@/hooks/useEdgeConfig"
import { DiagramEdgeType } from "@/edges"
import { useStepPathEdge } from "@/hooks/useStepPathEdge"
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
 * SA-5 `NNNext` edge — sequential flow between layers in the same
 * NNContainer (e.g. Conv2D → Pooling → Linear). Unidirectional with a
 * filled-arrow head. v3 source:
 * `packages/editor/src/main/packages/nn-diagram/nn-unidirectional/`.
 *
 * Edge `data` is intentionally minimal:
 * ```ts
 * { name?: string; points: IPoint[] }
 * ```
 * Per `docs/source/migrations/uml-v4-shape.md` (NNDiagram §) and the
 * SA-6.1 backend processor, no extra discriminators ride on this edge.
 */
export const NNNext = ({
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
  const anchorRef = useRef<SVGSVGElement | null>(null)
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

  const {
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
  })

  const { strokeColor, textColor } = getCustomColorsFromDataForEdge(data)
  const markerKey = `${id}-${markerStart ?? "none"}-${markerEnd ?? "none"}`

  const label =
    (data as { name?: string; label?: string } | null)?.name ??
    (data as { label?: string } | null)?.label ??
    ""

  return (
    <AssessmentSelectableWrapper elementId={id} asElement="g">
      <FeedbackDropzone elementId={id} asElement="path" elementType={type}>
        <g className="edge-container">
          <BaseEdge
            key={markerKey}
            id={id}
            path={currentPath}
            pointerEvents="none"
            style={{
              stroke: strokeColor,
              strokeDasharray: isReconnectingRef.current ? "none" : strokeDashArray,
              transition: hasInitialCalculation ? "opacity 0.1s ease-in" : "none",
              opacity: 1,
            }}
          />
          {!isReconnectingRef.current && (
            <EdgeInlineMarkers
              pathD={currentPath}
              markerEnd={markerEnd}
              markerStart={markerStart}
              strokeColor={strokeColor}
            />
          )}
          <path
            ref={pathRef}
            className="edge-overlay"
            d={overlayPath}
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
            onSourcePointerDown={(e) => handleEndpointPointerDown(e, "source")}
            onTargetPointerDown={(e) => handleEndpointPointerDown(e, "target")}
          />
          {isDiagramModifiable &&
            !isReconnectingRef.current &&
            allowMidpointDragging &&
            midpoints.map((point, i) => (
              <circle
                className="edge-circle"
                pointerEvents="all"
                key={`${id}-midpoint-${i}`}
                cx={point.x}
                cy={point.y}
                r={10}
                fill="lightgray"
                stroke="none"
                style={{ cursor: "grab", zIndex: 9999 }}
                onPointerDown={(e) => handlePointerDown(e, i)}
              />
            ))}
        </g>

        <EdgeMiddleLabels
          label={label}
          pathMiddlePosition={edgeData.pathMiddlePosition}
          isMiddlePathHorizontal={edgeData.isMiddlePathHorizontal}
          showRelationshipLabels={true}
          textColor={textColor}
        />

        <CommonEdgeElements
          id={id}
          pathMiddlePosition={edgeData.pathMiddlePosition}
          isDiagramModifiable={isDiagramModifiable}
          assessments={assessments}
          anchorRef={anchorRef}
          handleDelete={handleDelete}
          setPopOverElementId={setPopOverElementId}
          type={type}
        />
      </FeedbackDropzone>
    </AssessmentSelectableWrapper>
  )
}

// Side-effect registration into the central `_edgeTypeRegistry`.
registerEdgeTypes({ NNNext })
