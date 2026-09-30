import { BaseEdge, getBezierPath } from "@xyflow/react"
import { usePopoverAnchor } from "@/hooks/usePopoverAnchor"
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
import { useTranslation } from "@/i18n"

/**
 * `AgentStateTransition` edge — most complex edge in the migration.
 *
 * Edge `data` shape (canonical, per the brief and
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
 *   // Legacy preservation (per the brief): the v3 deserializer at
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
  })

  const { t } = useTranslation()
  const { strokeColor, textColor } = getCustomColorsFromDataForEdge(data)
  // Classic React Flow bézier stroke (the native "flow" edge) instead of the
  // shared UML step routing, so an agent flow reads as smooth connections.
  // Reconnection endpoints + the label still come from the hook.
  const [smoothPath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const markerKey = `${id}-${markerStart ?? "none"}-${markerEnd ?? "none"}`

  // Canvas label + invalid highlight (smart-gen
  // `agent-state-transition-component.tsx` getLabel / isInvalid).
  const d = (data ?? {}) as {
    name?: string
    label?: string
    transitionType?: "predefined" | "custom"
    predefined?: {
      predefinedType?: string
      intentName?: string
      fileType?: string
      formGuiId?: string
      conditionValue?:
        | string
        | { variable?: string; operator?: string; targetValue?: string }
    }
    custom?: { event?: string; condition?: string[] }
  }
  const cv =
    typeof d.predefined?.conditionValue === "object" &&
    d.predefined?.conditionValue !== null
      ? (d.predefined?.conditionValue as {
          variable?: string
          operator?: string
          targetValue?: string
        })
      : {}
  const getTriggerLabel = (): string => {
    if (d.transitionType === "custom") {
      const ev = d.custom?.event || "WildcardEvent"
      const n = d.custom?.condition?.length || 0
      const conditions = `${n} ${t("packages.AgentDiagram.transitionCanvasLabel.conditionsShort", "cond.")}`
      return ev === "None"
        ? `${t("packages.AgentDiagram.transitionCanvasLabel.noEvent", "No event")} + ${conditions}`
        : `${ev} + ${conditions}`
    }
    const pt = d.predefined?.predefinedType
    if (!pt) return ""
    if (pt === "when_intent_matched") {
      return (
        d.predefined?.intentName ||
        t("packages.AgentDiagram.transitionCanvasLabel.intent", "Intent")
      )
    }
    if (pt === "when_no_intent_matched") {
      return t("packages.AgentDiagram.transitionCanvasLabel.noIntent", "No intent")
    }
    if (pt === "when_variable_operation_matched") {
      return `${cv.variable || "?"} ${cv.operator || "?"} ${cv.targetValue || "?"}`
    }
    if (pt === "when_file_received") {
      return t("packages.AgentDiagram.transitionCanvasLabel.file", "File")
    }
    if (pt === "when_form_submitted") {
      return d.predefined?.formGuiId
        ? `${d.predefined.formGuiId} ${t("packages.AgentDiagram.transitionCanvasLabel.submitted", "Submitted")}`
        : t("packages.AgentDiagram.transitionLabel.formSubmitted", "Form Submitted")
    }
    if (pt === "auto") return t("packages.AgentDiagram.transitionLabel.auto", "Auto")
    return pt
  }
  const isInvalid = (): boolean => {
    if (d.transitionType === "custom") return false
    const pt = d.predefined?.predefinedType
    if (pt === "when_intent_matched") return !d.predefined?.intentName
    if (pt === "when_variable_operation_matched") {
      return !(cv.variable && cv.operator && cv.targetValue)
    }
    return false
  }
  const invalid = isInvalid()
  const trigger = getTriggerLabel()
  const composedLabel = [d.name ?? "", trigger].filter(Boolean).join(" · ")
  const label = composedLabel || (d.label as string) || ""
  const edgeStroke = invalid ? "#ef4444" : strokeColor
  const labelColor = invalid ? "#ef4444" : textColor

  return (
    <AssessmentSelectableWrapper elementId={id} asElement="g">
      <FeedbackDropzone elementId={id} asElement="path" elementType={type}>
        <g className="edge-container">
          <BaseEdge
            key={markerKey}
            id={id}
            path={smoothPath}
            pointerEvents="none"
            style={{
              stroke: edgeStroke,
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
              strokeColor={edgeStroke}
            />
          )}

          <path
            ref={pathRef}
            className="edge-overlay"
            d={smoothPath}
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

        </g>

        <EdgeMiddleLabels
          label={label}
          pathMiddlePosition={edgeData.pathMiddlePosition}
          isMiddlePathHorizontal={edgeData.isMiddlePathHorizontal}
          showRelationshipLabels={true}
          textColor={labelColor}
        />

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

// Side-effect registration: extends the central `_edgeTypeRegistry`.
registerEdgeTypes({ AgentStateTransition: AgentDiagramEdge })
