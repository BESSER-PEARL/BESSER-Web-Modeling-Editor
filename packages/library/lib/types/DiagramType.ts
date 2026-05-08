export type UMLDiagramType = keyof typeof UMLDiagramType

export const UMLDiagramType = {
  ClassDiagram: "ClassDiagram",
  ObjectDiagram: "ObjectDiagram",
  ActivityDiagram: "ActivityDiagram",
  UseCaseDiagram: "UseCaseDiagram",
  CommunicationDiagram: "CommunicationDiagram",
  ComponentDiagram: "ComponentDiagram",
  DeploymentDiagram: "DeploymentDiagram",
  PetriNet: "PetriNet",
  ReachabilityGraph: "ReachabilityGraph",
  SyntaxTree: "SyntaxTree",
  Flowchart: "Flowchart",
  BPMN: "BPMN",
  Sfc: "Sfc",
  // BESSER-specific diagram types — registered alongside the upstream stock
  // types so the editor can switch into them via the standard
  // `metadataStore.updateDiagramType()` path.
  StateMachineDiagram: "StateMachineDiagram",
  AgentDiagram: "AgentDiagram",
  UserDiagram: "UserDiagram",
  NNDiagram: "NNDiagram",
} as const

/**
 * The four BESSER-only diagram types added on top of the stock set.
 * Wave-2 sub-agents register their nodes / edges / palette entries /
 * inspectors against these.
 */
export const BESSER_DIAGRAM_TYPES: ReadonlyArray<UMLDiagramType> = [
  UMLDiagramType.StateMachineDiagram,
  UMLDiagramType.AgentDiagram,
  UMLDiagramType.UserDiagram,
  UMLDiagramType.NNDiagram,
] as const
