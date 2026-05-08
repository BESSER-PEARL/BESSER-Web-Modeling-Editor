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
 * SA-4 `AgentStateTransition` edge — most complex edge in the migration.
 *
 * Edge `data` shape (canonical, per the SA-4 brief and
 * `docs/source/migrations/uml-v4-shape.md`):
 *
 * ```ts
 * {
 *   transitionType: 'predefined' | 'custom';
 *   predefined?: {
 *     predefinedType: string;            // 'when_intent_matched', 'auto', …
 *     intentName?: string;
 *     fileType?: string;
 *     conditionValue?:
 *       | string
 *       | { variable: string; operator: string; targetValue: string };
 *   };
 *   custom?: {
 *     event: 'None' | 'DummyEvent' | 'WildcardEvent' | 'ReceiveMessageEvent'
 *          | 'ReceiveTextEvent' | 'ReceiveJSONEvent' | 'ReceiveFileEvent';
 *     condition: string[];
 *   };
 *   params: { [key: string]: string };
 *   name?: string;
 *   points: IPoint[];
 *
 *   // Legacy preservation (per the SA-4 brief): the v3 deserializer at
 *   // `agent-state-transition.ts` accepted at least 5 historical shapes;
 *   // the migrator collapses to the canonical shape above but keeps a
 *   // `legacy` bag and `legacyShape` discriminator for round-trip.
 *   legacyShape?: 1 | 2 | 3 | 4 | 5;
 *   legacy?: Record<string, unknown>;
 *
 *   // Flat aliases the inspector uses for "custom" mode editing —
 *   // mirror `custom.event` / `custom.condition` joined to a single
 *   // string. Round-trip-safe (the migrator re-derives these on read).
 *   customEvent?: string;
 *   customCondition?: string;
 *   customParams?: Record<string, unknown>;
 * }
 * ```
 *
 * The label rendered on the canvas is composed from the canonical fields:
 *   - `predefined`: `name [predefinedType: intentName/fileType]`
 *   - `custom`: `name [event] / condition`
 * — falling back to `data.label` when no shape data is present.
 */
export const AgentDiagramEdge = ({
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

  // Compose the label per the v4 canonical shape.
  const d = (data ?? {}) as {
    name?: string
    label?: string
    transitionType?: "predefined" | "custom"
    predefined?: {
      predefinedType?: string
      intentName?: string
      fileType?: string
      conditionValue?:
        | string
        | { variable?: string; operator?: string; targetValue?: string }
    }
    custom?: { event?: string; condition?: string[] }
  }

  let composedLabel = d.name ?? ""
  if (d.transitionType === "custom" && d.custom) {
    const ev = d.custom.event && d.custom.event !== "None" ? d.custom.event : ""
    const cond = (d.custom.condition ?? []).filter(Boolean).join(" && ")
    const tail = [ev ? `[${ev}]` : "", cond ? `/ ${cond}` : ""]
      .filter(Boolean)
      .join(" ")
    composedLabel = [composedLabel, tail].filter(Boolean).join(" ")
  } else if (d.transitionType === "predefined" && d.predefined) {
    const pt = d.predefined.predefinedType
    const v = d.predefined.intentName ?? d.predefined.fileType ?? ""
    const tail = pt ? `[${pt}${v ? `: ${v}` : ""}]` : ""
    composedLabel = [composedLabel, tail].filter(Boolean).join(" ")
  }
  const label = composedLabel || (d.label as string) || ""

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
                fill="lightgray"
                stroke="none"
                style={{ cursor: "grab", zIndex: 9999 }}
                onPointerDown={(e) => handlePointerDown(e, midPointIndex)}
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

// Side-effect registration: extends the central `_edgeTypeRegistry`.
registerEdgeTypes({ AgentStateTransition: AgentDiagramEdge })
