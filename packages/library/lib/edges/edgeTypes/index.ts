export * from "./ActivityDiagramEdge"
export * from "./ClassDiagramEdge"
export * from "./UseCaseDiagramEdge"
export * from "./ComponentDiagramEdge"
export * from "./SyntaxTreeEdge"
export * from "./SfcDiagramEdge"
export * from "./StateMachineDiagramEdge"
// Side-effect imports that extend the edge-type registry with the
// BESSER AgentDiagram + UserDiagram edge types via `registerEdgeTypes`.
export * from "./AgentDiagramEdge"
export * from "./AgentDiagramInitEdge"
export * from "./UserModelLink"
// Side-effect imports that register the BESSER NNDiagram edge
// types (NNNext / NNComposition / NNAssociation).
export * from "./NNNext"
export * from "./NNComposition"
export * from "./NNAssociation"
