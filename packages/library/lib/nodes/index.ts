export * from "./classDiagram"
export * from "./types"
export * from "./TitleAndDescriptionNode"
export * from "./flowchart"
export * from "./petriNetDiagram"
export * from "./bpmn"
export * from "./reachabilityGraphDiagram"
export * from "./sfcDiagram"
// SA-3: side-effect import that extends the node-type registry with the
// 11 BESSER StateMachineDiagram node types via `registerNodeTypes`.
export * from "./stateMachineDiagram"
// SA-4: side-effect imports that extend the node-type registry with the
// 8 BESSER AgentDiagram + 3 UserDiagram node types via `registerNodeTypes`.
export * from "./agentDiagram"
export * from "./userDiagram"
// SA-5: side-effect import that extends the node-type registry with the
// 18 BESSER NNDiagram node types via `registerNodeTypes`. NN-specific
// data shape: per-attribute children collapsed onto `node.data.attributes`.
export * from "./nnDiagram"
