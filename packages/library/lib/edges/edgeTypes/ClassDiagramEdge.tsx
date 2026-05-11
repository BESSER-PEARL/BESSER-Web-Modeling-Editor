import { BaseEdge } from "@xyflow/react"
import {
  BaseEdgeProps,
  EdgeEndpointMarkers,
  CommonEdgeElements,
} from "../GenericEdge"
import { EdgeEndLabels } from "../labelTypes/EdgeEndLabels"
import { useEdgeConfig } from "@/hooks/useEdgeConfig"
import { useStepPathEdge } from "@/hooks/useStepPathEdge"
import { useDiagramStore, usePopoverStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { useToolbar } from "@/hooks"
import { useRef } from "react"
import { EDGES } from "@/constants"
import { FeedbackDropzone } from "@/components/wrapper/FeedbackDropzone"
import { AssessmentSelectableWrapper } from "@/components"
import { getCustomColorsFromDataForEdge } from "@/utils"
import { EdgeInlineMarkers } from "@/components/svgs/edges/InlineMarker"
import { useSettingsStore } from "@/store/settingsStore"

export const ClassDiagramEdge = ({
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

  const config = useEdgeConfig(
    type as
      | "ClassAggregation"
      | "ClassInheritance"
      | "ClassRealization"
      | "ClassComposition"
      | "ClassBidirectional"
      | "ClassUnidirectional"
      | "ClassDependency"
  )

  const allowMidpointDragging =
    "allowMidpointDragging" in config ? config.allowMidpointDragging : true
  const enableStraightPath =
    "enableStraightPath" in config
      ? (config.enableStraightPath as boolean)
      : true

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
    enableStraightPath,
  })

  const { strokeColor, textColor } = getCustomColorsFromDataForEdge(data)
  const markerKey = `${id}-${markerStart ?? "none"}-${markerEnd ?? "none"}`

  // SA-FIX-Editor PC-11.4: wire `showAssociationNames` to the rendered
  // edge. v3 stored the user-typed association name on `data.name`
  // (matches `ClassEdgeEditPanel`); when the global setting is on we
  // render that name centred on the path. Inheritance / realization edges
  // never have a name and the empty-string guard suppresses the label.
  const showAssociationNames = useSettingsStore(
    (s) => s.showAssociationNames
  )
  const associationName =
    typeof (data as { name?: unknown })?.name === "string"
      ? ((data as { name?: string }).name ?? "")
      : ""

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
              strokeDasharray: isReconnectingRef.current
                ? "none"
                : strokeDashArray,
              transition: hasInitialCalculation
                ? "opacity 0.1s ease-in"
                : "none",
              opacity: 1,
            }}
          />

          {/* Inline markers for export compatibility (survives ungrouping) */}
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
            style={{
              opacity: isReconnectingRef.current ? 0 : 0.4,
            }}
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
            midpoints.map((point, midPointIndex) => (
              <circle
                className="edge-circle"
                pointerEvents="all"
                key={`${id}-midpoint-${midPointIndex}`}
                cx={point.x}
                cy={point.y}
                r={10}
                fill="var(--besser-gray-variant, #adb5bd)"
                stroke="none"
                style={{ cursor: "grab", zIndex: 9999 }}
                onPointerDown={(e) => handlePointerDown(e, midPointIndex)}
              />
            ))}
        </g>

        <EdgeEndLabels
          data={data}
          activePoints={edgeData.activePoints}
          sourceX={sourceX}
          sourceY={sourceY}
          targetX={targetX}
          targetY={targetY}
          sourcePosition={sourcePosition}
          targetPosition={targetPosition}
          textColor={textColor}
        />

        {/* SA-FIX-Editor PC-11.4: live association-name label, gated on
            the `showAssociationNames` setting. Mirrors the v3 mid-edge
            label position; centre-anchored above the midpoint. */}
        {showAssociationNames && associationName && (
          <text
            x={edgeData.pathMiddlePosition.x}
            y={edgeData.pathMiddlePosition.y - 8}
            textAnchor="middle"
            dominantBaseline="auto"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              fill: textColor,
              userSelect: "none",
              pointerEvents: "none",
            }}
            className="nodrag nopan"
          >
            {associationName}
          </text>
        )}

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
