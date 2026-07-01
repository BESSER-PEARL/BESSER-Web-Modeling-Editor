// `UMLDiagramType` is the value union, not the key union — so member access
// (`UMLDiagramType.BPMN`) type-checks against the alias even when key and
// value differ. The BPMN entry intentionally diverges (key `BPMN`, value
// `'BPMNDiagram'`) so the on-the-wire diagram-type matches BESSER's
// `"<Name>Diagram"` convention (`ClassDiagram`, `StateMachineDiagram`, …).
export const UMLDiagramType = {
  ClassDiagram: 'ClassDiagram',
  ObjectDiagram: 'ObjectDiagram',
  ActivityDiagram: 'ActivityDiagram',
  UseCaseDiagram: 'UseCaseDiagram',
  CommunicationDiagram: 'CommunicationDiagram',
  ComponentDiagram: 'ComponentDiagram',
  DeploymentDiagram: 'DeploymentDiagram',
  PetriNet: 'PetriNet',
  ReachabilityGraph: 'ReachabilityGraph',
  SyntaxTree: 'SyntaxTree',
  Flowchart: 'Flowchart',
  BPMN: 'BPMNDiagram',
  StateMachineDiagram: 'StateMachineDiagram',
  AgentDiagram: 'AgentDiagram',
  UserDiagram: 'UserDiagram',
  NNDiagram: 'NNDiagram',
} as const;
export type UMLDiagramType = (typeof UMLDiagramType)[keyof typeof UMLDiagramType];
