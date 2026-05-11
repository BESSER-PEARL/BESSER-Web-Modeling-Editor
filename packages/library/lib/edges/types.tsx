import { EdgeTypes } from "@xyflow/react"
import { ClassDiagramEdge } from "./edgeTypes/ClassDiagramEdge"
import { ActivityDiagramEdge } from "./edgeTypes/ActivityDiagramEdge"
import { UseCaseEdge } from "./edgeTypes/UseCaseDiagramEdge"
import { ComponentDiagramEdge } from "./edgeTypes/ComponentDiagramEdge"
import { DeploymentDiagramEdge } from "./edgeTypes/DeploymentDiagramEdge"
import { ObjectDiagramEdge } from "./edgeTypes/ObjectDiagramEdge"
import { FlowChartEdge } from "./edgeTypes/FlowChartEdge"
import { SyntaxTreeEdge } from "./edgeTypes/SyntaxTreeEdge"
import { SfcDiagramEdge } from "./edgeTypes/SfcDiagramEdge"
import { ReachabilityGraphEdge } from "./edgeTypes/ReachabilityGraphArc"
import { CommunicationDiagramEdge } from "./edgeTypes/CommunicationDiagramEdge"
import { BPMNDiagramEdge } from "./edgeTypes/BPMNDiagramEdge"
import { PetriNetEdge } from "./edgeTypes/PetriNetEdge"

/**
 * Default React-Flow edge-type registry shipped with BESSER WME.
 * `diagramEdgeTypes` (exported below) is a live, mutable view of this
 * registry plus any types registered at runtime via `registerEdgeTypes`.
 */
const defaultEdgeTypes = {
  ClassAggregation: ClassDiagramEdge,
  ClassInheritance: ClassDiagramEdge,
  ClassRealization: ClassDiagramEdge,
  ClassComposition: ClassDiagramEdge,
  ClassBidirectional: ClassDiagramEdge,
  ClassUnidirectional: ClassDiagramEdge,
  ClassDependency: ClassDiagramEdge,
  // ClassOCLLink + ClassLinkRel — both v3 had no dedicated
  // renderer (they extended UMLAssociation), so we wire them through
  // ClassDiagramEdge. ClassOCLLink draws as a dashed dependency-style
  // arrow (open arrow + dotted stroke) per the v3 component visual;
  // ClassLinkRel draws as a plain solid line.
  ClassOCLLink: ClassDiagramEdge,
  ClassLinkRel: ClassDiagramEdge,
  // CommentLink placeholder. v3 supported a dashed
  // dependency-style arrow from a Comment to any element; the full
  // inspector port is TODO, but exposing the type here lets users at
  // least anchor a link from the now-visible Comment handles. The visual
  // is the dashed-arrow `getEdgeMarkerStyles("CommentLink")` style.
  CommentLink: ClassDiagramEdge,

  ActivityControlFlow: ActivityDiagramEdge,

  ObjectLink: ObjectDiagramEdge,

  FlowChartFlowline: FlowChartEdge,

  SyntaxTreeLink: SyntaxTreeEdge,

  CommunicationLink: CommunicationDiagramEdge,

  PetriNetArc: PetriNetEdge,

  UseCaseAssociation: UseCaseEdge,
  UseCaseInclude: UseCaseEdge,
  UseCaseExtend: UseCaseEdge,
  UseCaseGeneralization: UseCaseEdge,

  ComponentDependency: ComponentDiagramEdge,
  ComponentProvidedInterface: ComponentDiagramEdge,
  ComponentRequiredInterface: ComponentDiagramEdge,
  ComponentRequiredThreeQuarterInterface: ComponentDiagramEdge,
  ComponentRequiredQuarterInterface: ComponentDiagramEdge,

  DeploymentAssociation: DeploymentDiagramEdge,
  DeploymentDependency: DeploymentDiagramEdge,
  DeploymentProvidedInterface: DeploymentDiagramEdge,
  DeploymentRequiredInterface: DeploymentDiagramEdge,
  DeploymentRequiredThreeQuarterInterface: DeploymentDiagramEdge,
  DeploymentRequiredQuarterInterface: DeploymentDiagramEdge,

  SfcDiagramEdge: SfcDiagramEdge,

  ReachabilityGraphArc: ReachabilityGraphEdge,

  BPMNSequenceFlow: BPMNDiagramEdge,
  BPMNMessageFlow: BPMNDiagramEdge,
  BPMNAssociationFlow: BPMNDiagramEdge,
  BPMNDataAssociationFlow: BPMNDiagramEdge,
} satisfies EdgeTypes

/**
 * Mutable registry. Defaults are seeded from `defaultEdgeTypes`; consumers
 * extend it via `registerEdgeTypes`. Same object reference is preserved so
 * existing callers reading `diagramEdgeTypes` once still see updates.
 */
const _edgeTypeRegistry: EdgeTypes = { ...defaultEdgeTypes }

/**
 * Register additional edge types. Existing entries are overwritten on
 * conflict (intentional for component swaps).
 */
export const registerEdgeTypes = (custom: EdgeTypes): void => {
  for (const [key, value] of Object.entries(custom)) {
    _edgeTypeRegistry[key] = value
  }
}

/**
 * The merged edge-type registry. Read sites pass this to
 * `<ReactFlow edgeTypes={diagramEdgeTypes} />`.
 */
export const diagramEdgeTypes: EdgeTypes = _edgeTypeRegistry

export const edgeConfig = {
  // Class edges - all allow midpoint dragging
  ClassAggregation: { allowMidpointDragging: true },
  ClassInheritance: { allowMidpointDragging: true },
  ClassRealization: { allowMidpointDragging: true },
  ClassComposition: { allowMidpointDragging: true },
  ClassBidirectional: { allowMidpointDragging: true },
  ClassUnidirectional: { allowMidpointDragging: true },
  ClassDependency: { allowMidpointDragging: true },
  // ClassOCLLink uses a dashed dependency-style stroke (matches
  // v3 OCL link visual). ClassLinkRel is a plain solid association
  // line (no markers, no roles).
  ClassOCLLink: { allowMidpointDragging: true },
  ClassLinkRel: { allowMidpointDragging: true },
  // Placeholder Comment→element dashed link.
  CommentLink: { allowMidpointDragging: true },

  // Activity edges - allow midpoint dragging
  ActivityControlFlow: { allowMidpointDragging: true },

  // Object edge
  ObjectLink: { allowMidpointDragging: true },

  //FlowChart edge
  FlowChartFlowline: { allowMidpointDragging: true },

  SyntaxTreeLink: {},

  ReachabilityGraphArc: { allowMidpointDragging: true },

  //PetriNet edge
  PetriNetArc: { showRelationshipLabels: true },

  // Communication diagram edge - allow midpoint dragging with multiple labels
  CommunicationLink: { allowMidpointDragging: true },

  // Use case edges - some show relationship labels
  UseCaseAssociation: { showRelationshipLabels: true }, // Show association labels
  UseCaseInclude: { showRelationshipLabels: true }, // Show <<include>>
  UseCaseExtend: { showRelationshipLabels: true }, // Show <<extend>>
  UseCaseGeneralization: { showRelationshipLabels: false }, // No stereotype labels

  //BPMN edges - all allow midpoint dragging
  BPMNSequenceFlow: {
    allowMidpointDragging: true,
    showRelationshipLabels: true,
  },
  BPMNMessageFlow: {
    allowMidpointDragging: true,
    showRelationshipLabels: true,
  },
  BPMNAssociationFlow: {
    allowMidpointDragging: true,
    showRelationshipLabels: true,
  },
  BPMNDataAssociationFlow: {
    allowMidpointDragging: true,
    showRelationshipLabels: true,
  },

  // Component edges - different midpoint settings
  ComponentDependency: { allowMidpointDragging: true },
  ComponentProvidedInterface: { allowMidpointDragging: true },
  ComponentRequiredInterface: { allowMidpointDragging: true },
  ComponentRequiredThreeQuarterInterface: { allowMidpointDragging: true },
  ComponentRequiredQuarterInterface: { allowMidpointDragging: true },

  // Deployment edges - with relationship labels
  DeploymentAssociation: {
    allowMidpointDragging: true,
    showRelationshipLabels: true,
  },
  DeploymentDependency: {
    allowMidpointDragging: true,
    showRelationshipLabels: false,
  },
  DeploymentProvidedInterface: {
    allowMidpointDragging: true,
    showRelationshipLabels: false,
  },
  DeploymentRequiredInterface: {
    allowMidpointDragging: true,
    showRelationshipLabels: false,
  },
  DeploymentRequiredThreeQuarterInterface: {
    allowMidpointDragging: true,
    showRelationshipLabels: false,
  },
  DeploymentRequiredQuarterInterface: {
    allowMidpointDragging: true,
    showRelationshipLabels: false,
  },

  SfcDiagramEdge: {
    allowMidpointDragging: true,
  },

  // StateMachineDiagram transition.
  StateTransition: {
    allowMidpointDragging: true,
    showRelationshipLabels: true,
  },

  // AgentDiagram transitions.
  AgentStateTransition: {
    allowMidpointDragging: true,
    showRelationshipLabels: true,
  },
  AgentStateTransitionInit: {
    allowMidpointDragging: true,
    showRelationshipLabels: false,
  },

  // UserDiagram link — same handling as ObjectLink (which it aliases).
  UserModelLink: { allowMidpointDragging: true },

  // NNDiagram edges. All allow midpoint dragging; relationship
  // labels are off by default (NN edges carry no label in v3).
  NNNext: { allowMidpointDragging: true, showRelationshipLabels: false },
  NNComposition: { allowMidpointDragging: true, showRelationshipLabels: false },
  NNAssociation: {
    allowMidpointDragging: true,
    showRelationshipLabels: false,
  },
} as const

// Bound to `defaultEdgeTypes` (not `diagramEdgeTypes`) so the canonical
// upstream key set stays statically known; runtime additions via
// `registerEdgeTypes` are widened to string at the boundary.
export type DiagramEdgeType = keyof typeof defaultEdgeTypes

export interface IPoint {
  x: number
  y: number
}
