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

  // Wire `showAssociationNames` to the rendered
  // edge. v3 stored the user-typed association name on `data.name`
  // (matches `ClassEdgeEditPanel`); when the global setting is on we
  // render that name centred on the path. Inheritance / realization edges
  // never have a name and the empty-string guard suppresses the label.
  const showAssociationNames = useSettingsStore(
    (s) => s.showAssociationNames
  )
  const classNotation = useSettingsStore((s) => s.classNotation)
  const associationName =
    typeof (data as { name?: unknown })?.name === "string"
      ? ((data as { name?: string }).name ?? "")
      : ""

  // ER (Chen) mode: for the four "plain" binary associations replace the
  // UML arrow/rhombus end markers with a named diamond drawn at the
  // midpoint of the path. Inheritance, realization, OCL link, dependency,
  // and link relationships keep their UML rendering. Mirrors v3
  // `uml-association-component.tsx` ER_DIAMOND_RELATIONSHIP_TYPES.
  const ER_DIAMOND_TYPES: ReadonlyArray<string> = [
    "ClassBidirectional",
    "ClassUnidirectional",
    "ClassAggregation",
    "ClassComposition",
  ]
  const showsERDiamond =
    classNotation === "ER" && ER_DIAMOND_TYPES.includes(type as string)
  const effectiveMarkerStart = showsERDiamond ? undefined : markerStart
  const effectiveMarkerEnd = showsERDiamond ? undefined : markerEnd
  const markerKey = `${id}-${effectiveMarkerStart ?? "none"}-${
    effectiveMarkerEnd ?? "none"
  }-${showsERDiamond ? "er" : "uml"}`
  const erDiamondFill =
    (data as { strokeColor?: string } | undefined)?.strokeColor &&
    typeof (data as { fillColor?: string } | undefined)?.fillColor === "string"
      ? ((data as { fillColor?: string }).fillColor as string)
      : "var(--besser-background, #ffffff)"

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

          {/* Inline markers for export compatibility (survives ungrouping).
              In ER mode for ER-capable association types, the inline
              markers are suppressed in favour of the midpoint diamond
              rendered below. */}
          {!isReconnectingRef.current && (
            <EdgeInlineMarkers
              pathD={currentPath}
              markerEnd={effectiveMarkerEnd}
              markerStart={effectiveMarkerStart}
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

        {/* ER (Chen) diamond at the path midpoint, replacing the UML
            arrow/rhombus markers for the four binary association types.
            The diamond carries the association name centred inside (so
            we suppress the separate UML mid-edge name label below to
            avoid duplication). Mirrors v3 `uml-association-component.tsx`
            ER branch. */}
        {showsERDiamond && (
          <g
            transform={`translate(${edgeData.pathMiddlePosition.x} ${edgeData.pathMiddlePosition.y})`}
            pointerEvents="none"
            data-testid="er-relationship-diamond"
          >
            <polygon
              points="-30,0 0,-15 30,0 0,15"
              fill={erDiamondFill}
              stroke={strokeColor}
              strokeWidth={1}
            />
            {associationName && (
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontSize: "11px",
                  fill: textColor,
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              >
                {associationName}
              </text>
            )}
          </g>
        )}

        {/* Live association-name label, gated on
            the `showAssociationNames` setting. Mirrors the v3 mid-edge
            label position; centre-anchored above the midpoint. In ER
            mode the name is rendered inside the diamond, so suppress
            this label for ER-capable association types. */}
        {showAssociationNames && associationName && !showsERDiamond && (
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
