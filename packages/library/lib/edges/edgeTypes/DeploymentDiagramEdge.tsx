import { BaseEdge, useStore } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
import {
  BaseEdgeProps,
  EdgeEndpointMarkers,
  CommonEdgeElements,
} from "../GenericEdge"
import { useDiagramStore, usePopoverStore } from "@/store/context"
import { useShallow } from "zustand/shallow"
import { EdgeMiddleLabels, truncateLabel } from "../labelTypes/EdgeMiddleLabels"
import {
  estimateMiddleLabelWidth,
  placeMiddleLabel,
} from "../labelTypes/middleLabelPlacement"
import type { IPoint } from "../Connection"
import { internalNodeRect } from "@/utils/nodeShapes"
import {
  relationshipLabelDirection,
  relationshipLabelLayout,
} from "@/utils/relationshipMidpoint"
import { useEdgeConfig } from "@/hooks/useEdgeConfig"
import { useStepPathEdge } from "@/hooks/useStepPathEdge"
import { useToolbar } from "@/hooks"
import { EDGES } from "@/constants"
import { FeedbackDropzone } from "@/components/wrapper/FeedbackDropzone"
import { AssessmentSelectableWrapper } from "@/components"
import { getCustomColorsFromDataForEdge } from "@/utils/layoutUtils"
import { EdgeInlineMarkers } from "@/components/svgs/edges/InlineMarker"
import { resolveRequiredInterfaceEdgeType } from "@/utils"

/** Baseline distance from the «stereotype» line to the name below it. */
const STEREOTYPE_LINE_OFFSET = 14

/**
 * «stereotype» of a deployment association: one line above its name label
 * (same placement as `EdgeMiddleLabels`), or at the path midpoint when the
 * association has no name.
 */
const DeploymentStereotypeLabel = ({
  stereotype,
  label,
  points,
  pathMiddlePosition,
  isMiddlePathHorizontal,
  textColor,
}: {
  stereotype: string
  label?: string | null
  points?: IPoint[]
  pathMiddlePosition: IPoint
  isMiddlePathHorizontal: boolean
  textColor: string
}) => {
  const nodeLookup = useStore((state) => state.nodeLookup)
  const placement =
    label && points && points.length >= 2
      ? placeMiddleLabel(
          points,
          estimateMiddleLabelWidth(truncateLabel(label)),
          [...nodeLookup.values()].filter((n) => !n.hidden).map(internalNodeRect)
        )
      : null
  const position = placement
    ? {
        x: placement.x,
        y: placement.y - STEREOTYPE_LINE_OFFSET,
        textAnchor: placement.textAnchor,
        dominantBaseline: placement.dominantBaseline,
      }
    : {
        x: pathMiddlePosition.x,
        y: pathMiddlePosition.y,
        ...relationshipLabelLayout(
          relationshipLabelDirection(isMiddlePathHorizontal)
        ),
      }

  return (
    <text
      {...position}
      fill={textColor}
      fontSize={11}
      fontWeight={600}
      pointerEvents="none"
      className="besser-edge-label"
      data-testid="edge-stereotype-label"
    >
      {`«${stereotype}»`}
    </text>
  )
}

const DEPLOYMENT_REQUIRED_INTERFACE_TYPES = [
  "DeploymentRequiredInterface",
  "DeploymentRequiredQuarterInterface",
  "DeploymentRequiredThreeQuarterInterface",
] as const

export const DeploymentDiagramEdge = ({
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

  const config = useEdgeConfig(
    type as
      | "DeploymentDependency"
      | "DeploymentProvidedInterface"
      | "DeploymentRequiredInterface"
      | "DeploymentRequiredThreeQuarterInterface"
      | "DeploymentRequiredQuarterInterface"
  )

  const allowMidpointDragging =
    "allowMidpointDragging" in config ? config.allowMidpointDragging : true
  const showRelationshipLabels =
    "showRelationshipLabels" in config ? config.showRelationshipLabels : false

  const { edges, assessments } = useDiagramStore(
    useShallow((state) => ({
      edges: state.edges,
      assessments: state.assessments,
    }))
  )

  const setPopOverElementId = usePopoverStore(
    useShallow((state) => state.setPopOverElementId)
  )

  const dynamicEdgeType = resolveRequiredInterfaceEdgeType({
    type,
    id,
    target,
    targetHandleId,
    edges,
    requiredTypes: DEPLOYMENT_REQUIRED_INTERFACE_TYPES,
    defaultType: "DeploymentRequiredInterface",
    reducedType: "DeploymentRequiredQuarterInterface",
  })

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
    type: dynamicEdgeType,
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
    enableStraightPath: true,
  })

  const { strokeColor, textColor } = getCustomColorsFromDataForEdge(data)
  // Only an association owns a stereotype; one left over after a type switch stays hidden.
  const stereotype =
    type === "DeploymentAssociation" ? data?.stereotype : undefined
  const markerKey = `${id}-${markerStart ?? "none"}-${markerEnd ?? "none"}`

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

        <EdgeMiddleLabels
          label={data?.label}
          pathMiddlePosition={edgeData.pathMiddlePosition}
          isMiddlePathHorizontal={edgeData.isMiddlePathHorizontal}
          points={edgeData.activePoints}
          showRelationshipLabels={showRelationshipLabels}
          textColor={textColor}
        />

        {stereotype && (
          <DeploymentStereotypeLabel
            stereotype={stereotype}
            label={showRelationshipLabels ? data?.label : undefined}
            points={edgeData.activePoints}
            pathMiddlePosition={edgeData.pathMiddlePosition}
            isMiddlePathHorizontal={edgeData.isMiddlePathHorizontal}
            textColor={textColor}
          />
        )}

        <CommonEdgeElements
          id={id}
          pathMiddlePosition={edgeData.pathMiddlePosition}
          isDiagramModifiable={isDiagramModifiable}
          assessments={assessments}
          anchorRef={anchorRef}
          anchorEl={anchorEl}
          handleDelete={handleDelete}
          setPopOverElementId={setPopOverElementId}
          type={dynamicEdgeType}
        />
      </FeedbackDropzone>
    </AssessmentSelectableWrapper>
  )
}
