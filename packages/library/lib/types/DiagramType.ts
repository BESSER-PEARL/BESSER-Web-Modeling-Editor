export type UMLDiagramType = (typeof UMLDiagramType)[keyof typeof UMLDiagramType]

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
  // Key `BPMN`, value `BPMNDiagram`: the on-the-wire diagram-type value
  // follows BESSER's `<Name>Diagram` convention (matches develop's
  // diagram-type.ts and the backend's BPMN_DIAGRAM_TYPES contract).
  BPMN: "BPMNDiagram",
  Sfc: "Sfc",
  StateMachineDiagram: "StateMachineDiagram",
  AgentDiagram: "AgentDiagram",
  UserDiagram: "UserDiagram",
  NNDiagram: "NNDiagram",
} as const
