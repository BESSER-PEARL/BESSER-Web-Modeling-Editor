import { useDiagramStore } from "@/store"
import { useDiagramModifiable } from "@/hooks/useDiagramModifiable"
import AssessmentIcon from "@/components/svgs/AssessmentIcon"

/**
 * Node types whose own SVG already draws the assessment score icon (they
 * receive `showAssessmentResults` and render `<AssessmentIcon>` at the
 * node's top-right corner). Every OTHER node type gets the generic badge
 * below, so scores show on every element like v3 `assessable.tsx` did —
 * State*, Agent*, NN*, UserModelAttribute/Icon, ClassOCLConstraint,
 * comment, colorDescription, … — without editing each diagram's renderer.
 */
export const NODE_TYPES_WITH_OWN_ASSESSMENT_ICON: ReadonlySet<string> = new Set(
  [
    "class",
    "package",
    "objectName",
    "communicationObjectName",
    "activity",
    "activityInitialNode",
    "activityFinalNode",
    "activityActionNode",
    "activityObjectNode",
    "activityMergeNode",
    "activityForkNode",
    "activityForkNodeHorizontal",
    "useCase",
    "useCaseActor",
    "useCaseSystem",
    "component",
    "componentInterface",
    "componentSubsystem",
    "deploymentNode",
    "deploymentComponent",
    "deploymentArtifact",
    "deploymentInterface",
    "flowchartTerminal",
    "flowchartProcess",
    "flowchartDecision",
    "flowchartInputOutput",
    "flowchartFunctionCall",
    "syntaxTreeTerminal",
    "syntaxTreeNonterminal",
    "petriNetPlace",
    "petriNetTransition",
    "reachabilityGraphMarking",
    "sfcStart",
    "sfcStep",
    "bpmnTask",
    "bpmnStartEvent",
    "bpmnIntermediateEvent",
    "bpmnEndEvent",
    "bpmnGateway",
    "bpmnSubprocess",
    "bpmnTransaction",
    "bpmnCallActivity",
    "bpmnAnnotation",
    "bpmnDataObject",
    "bpmnDataStore",
    "bpmnPool",
    "bpmnSwimlane",
    "bpmnGroup",
    "UserModelName",
  ]
)

const BADGE_SIZE = 30

/**
 * Generic assessment score badge, centred on the node's top-right corner —
 * the same spot the per-diagram SVGs use (`<AssessmentIcon x={width - 15}
 * y={-15} />`). Rendered by `DefaultNodeWrapper`; shown only outside
 * modelling mode (assessment / exporting / readonly), and only when the
 * element has a score.
 */
export const NodeAssessmentBadge = ({
  elementId,
  nodeType,
}: {
  elementId: string
  nodeType?: string
}) => {
  const score = useDiagramStore((state) => state.assessments[elementId]?.score)
  const isDiagramModifiable = useDiagramModifiable()

  if (isDiagramModifiable || score === undefined) return null
  if (nodeType && NODE_TYPES_WITH_OWN_ASSESSMENT_ICON.has(nodeType)) {
    return null
  }

  return (
    <svg
      className="besser-node-assessment-badge"
      data-testid={`assessment-badge-${elementId}`}
      width={BADGE_SIZE}
      height={BADGE_SIZE}
      overflow="visible"
      style={{
        position: "absolute",
        top: -BADGE_SIZE / 2,
        right: -BADGE_SIZE / 2,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <AssessmentIcon x={0} y={0} score={score} />
    </svg>
  )
}
