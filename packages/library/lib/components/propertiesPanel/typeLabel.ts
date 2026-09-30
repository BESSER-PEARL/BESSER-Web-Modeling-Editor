import en from "../../../../i18n/en/editor.json"
import { translate, hasTranslation } from "@/i18n"
import { Locale } from "@/typings"

/**
 * Localized element-type heading for the properties panel — the React Flow
 * port of the v3 `properties-panel.tsx#getTypeLabel`.
 *
 * Element-type names live under `packages.<Group>.<ElementType>` in the
 * editor bundles. React Flow node types are lowerCamelCase (`class`,
 * `bpmnTask`, `activityActionNode`) while the v3 keys are PascalCase
 * (`Class`, `BPMNTask`, `ActivityActionNode`), and a few names diverged
 * entirely — those are mapped explicitly below. The diagram's own group is
 * tried first, then every other group (shared names like `Interface` or
 * `Component` translate to the same word everywhere). Falls back to the
 * English "insert spaces before capitals" label so the header never blanks.
 */

const PACKAGE_GROUPS: string[] = Object.keys(
  (en as { packages?: Record<string, unknown> }).packages ?? {}
)

/** Diagram-type value → i18n group name, where they differ. */
const GROUP_ALIASES: Record<string, string> = {
  StateMachineDiagram: "StateDiagram",
}

/** React Flow element type → v3 i18n key (`<Group>.<Type>` or bare `<Type>`). */
const TYPE_ALIASES: Record<string, string> = {
  communicationObjectName: "CommunicationDiagram.ObjectName",
  colorDescription: "ColorLegend.ColorLegend",
  comment: "Comment.Comment",
  CommentLink: "Comment.Comment",
  ComponentProvidedInterface: "ComponentDiagram.ComponentInterfaceProvided",
  ComponentRequiredInterface: "ComponentDiagram.ComponentInterfaceRequired",
  ComponentRequiredThreeQuarterInterface:
    "ComponentDiagram.ComponentInterfaceRequired",
  ComponentRequiredQuarterInterface:
    "ComponentDiagram.ComponentInterfaceRequired",
  DeploymentProvidedInterface: "DeploymentDiagram.DeploymentInterfaceProvided",
  DeploymentRequiredInterface: "DeploymentDiagram.DeploymentInterfaceRequired",
  DeploymentRequiredThreeQuarterInterface:
    "DeploymentDiagram.DeploymentInterfaceRequired",
  DeploymentRequiredQuarterInterface:
    "DeploymentDiagram.DeploymentInterfaceRequired",
  FlowChartFlowline: "Flowchart.FlowchartFlowline",
  ClassUnidirectional: "ClassDiagram.ClassBidirectional",
  activityForkNodeHorizontal: "ActivityDiagram.ActivityForkNode",
  reachabilityGraphMarking: "ReachabilityGraph.ReachabilityGraphMarking",
  bpmnSwimlane: "BPMNDiagram.BPMNSwimlane",
}

export const formatTypeName = (type: string): string =>
  type.replace(/([A-Z])/g, " $1").trim()

/** `bpmnTask` → `BPMNTask`, `activityActionNode` → `ActivityActionNode`. */
const toV3TypeName = (type: string): string => {
  if (type.startsWith("bpmn")) return `BPMN${type.slice(4)}`
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export const getTypeLabel = (
  type: string,
  diagramType: string | undefined,
  locale: Locale
): string => {
  const fallback = formatTypeName(type)
  const alias = TYPE_ALIASES[type]
  if (alias) {
    const key = alias.includes(".") ? `packages.${alias}` : undefined
    if (key && hasTranslation(key)) return translate(key, fallback, locale)
  }

  const candidates = Array.from(new Set([type, toV3TypeName(type)]))
  const ownGroup = diagramType
    ? (GROUP_ALIASES[diagramType] ?? diagramType)
    : undefined
  const groups = ownGroup
    ? [ownGroup, ...PACKAGE_GROUPS.filter((g) => g !== ownGroup)]
    : PACKAGE_GROUPS
  for (const group of groups) {
    for (const name of candidates) {
      const key = `packages.${group}.${name}`
      if (hasTranslation(key)) return translate(key, fallback, locale)
    }
  }
  return fallback
}

/**
 * Element-type label for the assessment boxes ("Assessment for <type> …").
 * The boxes are also used for class/object rows, passed as the literal
 * types `attribute` / `method` (any case) — those map to the v3 member keys.
 */
export const getAssessmentTypeLabel = (
  type: string,
  diagramType: string | undefined,
  locale: Locale
): string => {
  switch (type.toLowerCase()) {
    case "attribute":
      return translate("packages.ClassDiagram.ClassAttribute", "Attribute", locale)
    case "method":
      return translate("packages.ClassDiagram.ClassMethod", "Method", locale)
    case "node":
      return type
    default:
      return getTypeLabel(type, diagramType, locale)
  }
}
