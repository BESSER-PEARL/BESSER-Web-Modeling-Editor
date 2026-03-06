import { ComponentType } from 'react';
import { DefaultPopup } from './common/default-popup';
import { DefaultRelationshipPopup } from './common/default-relationship-popup';
import { UMLClassifierUpdate } from './common/uml-classifier/uml-classifier-update';
import { UMLActivityControlFlowUpdate } from './uml-activity-diagram/uml-activity-control-flow/uml-activity-control-flow-update';
import { UMLActivityMergeNodeUpdate } from './uml-activity-diagram/uml-activity-merge-node/uml-activity-merge-node-update';
import { UMLComponentSubsystemUpdate } from './uml-component-diagram/uml-component-subsystem/uml-component-subsystem-update';
import { UMLComponentUpdate } from './common/uml-component/uml-component-update';
import { UMLClassAssociationUpdate } from './uml-class-diagram/uml-class-association/uml-class-association-update';
import { UMLCommunicationLinkUpdate } from './uml-communication-diagram/uml-communication-link/uml-communication-link-update';
import { UMLComponentAssociationUpdate } from './uml-component-diagram/uml-component-association-update';
import { UMLDeploymentAssociationUpdate } from './uml-deployment-diagram/uml-deployment-association/uml-deployment-association-update';
import { UMLDeploymentNodeUpdate } from './uml-deployment-diagram/uml-deployment-node/uml-deployment-node-update';
import { UMLElementType } from './uml-element-type';
import { UMLObjectNameUpdate } from './uml-object-diagram/uml-object-name/uml-object-name-update';
import { UMLObjectLinkUpdate } from './uml-object-diagram/uml-object-link/uml-object-link-update';
import { UMLRelationshipType } from './uml-relationship-type';
import { UMLUseCaseAssociationUpdate } from './uml-use-case-diagram/uml-use-case-association/uml-use-case-association-update';
import { UMLPetriNetPlaceUpdate } from './uml-petri-net/uml-petri-net-place/uml-petri-net-place-update';
import { UMLPetriNetArcUpdate } from './uml-petri-net/uml-petri-net-arc/uml-petri-net-arc-update';
import { UMLReachabilityGraphArcUpdate } from './uml-reachability-graph/uml-reachability-graph-arc/uml-reachability-graph-arc-update';
import { UMLReachabilityGraphMarkingUpdate } from './uml-reachability-graph/uml-reachability-graph-marking/uml-reachability-graph-marking-update';
import { SyntaxTreeTerminalUpdate } from './syntax-tree/syntax-tree-terminal/syntax-tree-terminal-update';
import { SyntaxTreeNonterminalUpdate } from './syntax-tree/syntax-tree-nonterminal/syntax-tree-nonterminal-update';
import { FlowchartTerminalUpdate } from './flowchart/flowchart-terminal/flowchart-terminal-update';
import { FlowchartProcessUpdate } from './flowchart/flowchart-process/flowchart-process-update';
import { FlowchartDecisionUpdate } from './flowchart/flowchart-decision/flowchart-decision-update';
import { FlowchartFunctionCallUpdate } from './flowchart/flowchart-function-call/flowchart-function-call-update';
import { FlowchartInputOutputUpdate } from './flowchart/flowchart-input-output/flowchart-input-output-update';
import { FlowchartFlowlineUpdate } from './flowchart/flowchart-flowline/flowchart-flowline-update';
import { ColorLegendUpdate } from './common/color-legend/color-legend-update';
import { CommentsUpdate } from './common/comments/comments-update';

import { BPMNFlowUpdate } from './bpmn/bpmn-flow/bpmn-flow-update';
import { BPMNGatewayUpdate } from './bpmn/bpmn-gateway/bpmn-gateway-update';
import { BPMNPoolUpdate } from './bpmn/bpmn-pool/bpmn-pool-update';
import { BPMNIntermediateEventUpdate } from './bpmn/bpmn-intermediate-event/bpmn-intermediate-event-update';
import { BPMNStartEventUpdate } from './bpmn/bpmn-start-event/bpmn-start-event-update';
import { BPMNEndEventUpdate } from './bpmn/bpmn-end-event/bpmn-end-event-update';
import { BPMNTaskUpdate } from './bpmn/bpmn-task/bpmn-task-update';
import { ClassOCLConstraintUpdate } from './uml-class-diagram/uml-class-ocl/uml-class-ocl-constraint-update';
import { UMLStateMergeNodeUpdate } from './uml-state-diagram/uml-state-merge-node/uml-state-merge-node-update';
import { UMLStateTransitionUpdate } from './uml-state-diagram/uml-state-transition/uml-state-transition-update';
import { UMLStateCodeBlockUpdate } from './uml-state-diagram/uml-state-code-block/uml-state-code-block-update';
import { UMLStateUpdate } from './uml-state-diagram/uml-state/uml-state-update';

import { AgentIntentBodyUpdate } from './agent-state-diagram/agent-intent-object-component/agent-intent-update';
import { AgentRagElementUpdate } from './agent-state-diagram/agent-rag-element/agent-rag-element-update';
import { AgentStateUpdate } from './agent-state-diagram/agent-state/agent-state-update';
import { AgentStateTransitionUpdate } from './agent-state-diagram/agent-state-transition/agent-state-transition-update';
import UMLUserModelAttributeUpdate from './user-modeling/uml-user-model-attribute/uml-user-model-attribute-update';

import { NNElementType } from './nn-diagram';
import { NNAttributeUpdate } from './nn-diagram/attribute-update/nn-attribute-update';
import { NNComponentUpdate } from './nn-diagram/nn-component/nn-component-update';
import { NNReferenceUpdate } from './nn-diagram/nn-reference/nn-reference-update';

export type Popups = { [key in UMLElementType | UMLRelationshipType]: ComponentType<{ element: any }> | null };
export const Popups: { [key in UMLElementType | UMLRelationshipType]: ComponentType<{ element: any }> | null } = {
  // Elements
  [UMLElementType.Package]: DefaultPopup,
  [UMLElementType.Class]: UMLClassifierUpdate,
  [UMLElementType.AbstractClass]: UMLClassifierUpdate,
  [UMLElementType.Interface]: UMLClassifierUpdate,
  [UMLElementType.Enumeration]: UMLClassifierUpdate,
  [UMLElementType.ClassAttribute]: null,
  [UMLElementType.ClassMethod]: null,
  [UMLElementType.ClassOCLConstraint]: ClassOCLConstraintUpdate,
  [UMLElementType.ObjectName]: UMLObjectNameUpdate,
  [UMLElementType.ObjectAttribute]: null,
  [UMLElementType.ObjectMethod]: null,
  [UMLElementType.ObjectIcon]: null,
  [UMLElementType.UserModelName]: UMLObjectNameUpdate,
  [UMLElementType.UserModelAttribute]: null,
  [UMLElementType.UserModelIcon]: null,
  [UMLElementType.Activity]: DefaultPopup,
  [UMLElementType.ActivityActionNode]: DefaultPopup,
  [UMLElementType.ActivityFinalNode]: DefaultPopup,
  [UMLElementType.ActivityForkNode]: DefaultPopup,
  [UMLElementType.ActivityForkNodeHorizontal]: DefaultPopup,
  [UMLElementType.ActivityInitialNode]: DefaultPopup,
  [UMLElementType.ActivityMergeNode]: UMLActivityMergeNodeUpdate,
  [UMLElementType.ActivityObjectNode]: DefaultPopup,
  [UMLElementType.UseCase]: DefaultPopup,
  [UMLElementType.UseCaseActor]: DefaultPopup,
  [UMLElementType.UseCaseSystem]: DefaultPopup,
  [UMLElementType.Component]: UMLComponentUpdate,
  [UMLElementType.Subsystem]: UMLComponentSubsystemUpdate,
  [UMLElementType.ComponentInterface]: DefaultPopup,
  [UMLElementType.DeploymentNode]: UMLDeploymentNodeUpdate,
  [UMLElementType.DeploymentComponent]: UMLComponentUpdate,
  [UMLElementType.DeploymentArtifact]: DefaultPopup,
  [UMLElementType.DeploymentInterface]: DefaultPopup,
  [UMLElementType.PetriNetPlace]: UMLPetriNetPlaceUpdate,
  [UMLElementType.PetriNetTransition]: DefaultPopup,
  [UMLElementType.ReachabilityGraphMarking]: UMLReachabilityGraphMarkingUpdate,
  [UMLElementType.CommunicationLinkMessage]: null,
  [UMLElementType.SyntaxTreeTerminal]: SyntaxTreeTerminalUpdate,
  [UMLElementType.SyntaxTreeNonterminal]: SyntaxTreeNonterminalUpdate,
  [UMLElementType.FlowchartTerminal]: FlowchartTerminalUpdate,
  [UMLElementType.FlowchartProcess]: FlowchartProcessUpdate,
  [UMLElementType.FlowchartDecision]: FlowchartDecisionUpdate,
  [UMLElementType.FlowchartFunctionCall]: FlowchartFunctionCallUpdate,
  [UMLElementType.FlowchartInputOutput]: FlowchartInputOutputUpdate,
  [UMLElementType.ColorLegend]: ColorLegendUpdate,
  [UMLElementType.Comments]: CommentsUpdate,

  [UMLElementType.BPMNTask]: BPMNTaskUpdate,
  [UMLElementType.BPMNSubprocess]: DefaultPopup,
  [UMLElementType.BPMNTransaction]: DefaultPopup,
  [UMLElementType.BPMNCallActivity]: DefaultPopup,
  [UMLElementType.BPMNAnnotation]: DefaultPopup,
  [UMLElementType.BPMNStartEvent]: BPMNStartEventUpdate,
  [UMLElementType.BPMNIntermediateEvent]: BPMNIntermediateEventUpdate,
  [UMLElementType.BPMNEndEvent]: BPMNEndEventUpdate,
  [UMLElementType.BPMNGateway]: BPMNGatewayUpdate,
  [UMLElementType.BPMNDataObject]: DefaultPopup,
  [UMLElementType.BPMNDataStore]: DefaultPopup,
  [UMLElementType.BPMNGroup]: DefaultPopup,
  [UMLElementType.BPMNPool]: BPMNPoolUpdate,
  [UMLElementType.BPMNSwimlane]: DefaultPopup,
  [UMLElementType.State]: UMLStateUpdate,
  [UMLElementType.StateBody]: null,
  [UMLElementType.StateFallbackBody]: null,
  [UMLElementType.StateActionNode]: DefaultPopup,
  [UMLElementType.StateFinalNode]: DefaultPopup,
  [UMLElementType.StateForkNode]: DefaultPopup,
  [UMLElementType.StateForkNodeHorizontal]: DefaultPopup,
  [UMLElementType.StateInitialNode]: DefaultPopup,
  [UMLElementType.StateMergeNode]: UMLStateMergeNodeUpdate,
  [UMLElementType.StateObjectNode]: DefaultPopup,
  [UMLElementType.StateCodeBlock]: UMLStateCodeBlockUpdate,
  [UMLElementType.AgentIntent]: AgentIntentBodyUpdate,
  [UMLElementType.AgentIntentBody]: null,
  [UMLElementType.AgentRagElement]: AgentRagElementUpdate,
  [UMLElementType.AgentState]: AgentStateUpdate,
  [UMLElementType.AgentStateBody]: null,
  [UMLElementType.AgentStateFallbackBody]: null,
  // [UMLElementType.AgentStateBody]: null,
  // Relationships
  [UMLRelationshipType.ClassAggregation]: UMLClassAssociationUpdate,
  [UMLRelationshipType.ClassBidirectional]: UMLClassAssociationUpdate,
  [UMLRelationshipType.ClassComposition]: UMLClassAssociationUpdate,
  [UMLRelationshipType.ClassDependency]: UMLClassAssociationUpdate,
  [UMLRelationshipType.ClassInheritance]: UMLClassAssociationUpdate,
  [UMLRelationshipType.ClassRealization]: UMLClassAssociationUpdate,
  [UMLRelationshipType.ClassUnidirectional]: UMLClassAssociationUpdate,
  [UMLRelationshipType.ClassOCLLink]: DefaultRelationshipPopup,
  [UMLRelationshipType.Link]: DefaultRelationshipPopup,
  [UMLRelationshipType.ClassLinkRel]: DefaultRelationshipPopup,
  [UMLRelationshipType.ObjectLink]: UMLObjectLinkUpdate,
  [UMLRelationshipType.UserModelLink]: UMLObjectLinkUpdate,
  [UMLRelationshipType.ActivityControlFlow]: UMLActivityControlFlowUpdate,
  [UMLRelationshipType.UseCaseAssociation]: UMLUseCaseAssociationUpdate,
  [UMLRelationshipType.UseCaseExtend]: UMLUseCaseAssociationUpdate,
  [UMLRelationshipType.UseCaseGeneralization]: UMLUseCaseAssociationUpdate,
  [UMLRelationshipType.UseCaseInclude]: UMLUseCaseAssociationUpdate,
  [UMLRelationshipType.CommunicationLink]: UMLCommunicationLinkUpdate,
  [UMLRelationshipType.ComponentInterfaceProvided]: UMLComponentAssociationUpdate,
  [UMLRelationshipType.ComponentInterfaceRequired]: UMLComponentAssociationUpdate,
  [UMLRelationshipType.ComponentDependency]: UMLComponentAssociationUpdate,
  [UMLRelationshipType.DeploymentAssociation]: UMLDeploymentAssociationUpdate,
  [UMLRelationshipType.DeploymentDependency]: UMLDeploymentAssociationUpdate,
  [UMLRelationshipType.DeploymentInterfaceProvided]: UMLDeploymentAssociationUpdate,
  [UMLRelationshipType.DeploymentInterfaceRequired]: UMLDeploymentAssociationUpdate,
  [UMLRelationshipType.PetriNetArc]: UMLPetriNetArcUpdate,
  [UMLRelationshipType.ReachabilityGraphArc]: UMLReachabilityGraphArcUpdate,
  [UMLRelationshipType.SyntaxTreeLink]: DefaultRelationshipPopup,
  [UMLRelationshipType.FlowchartFlowline]: FlowchartFlowlineUpdate,
  [UMLRelationshipType.BPMNFlow]: BPMNFlowUpdate,
  [UMLRelationshipType.StateTransition]: UMLStateTransitionUpdate,
  [UMLRelationshipType.AgentStateTransition]: AgentStateTransitionUpdate,
  [UMLRelationshipType.AgentStateTransitionInit]: DefaultRelationshipPopup,

  [NNElementType.Conv1DLayer]: NNComponentUpdate,
  // Conv1D Attributes
  [NNElementType.NameAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.KernelDimAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.OutChannelsAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.StrideDimAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.InChannelsAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.PaddingAmountAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.PaddingTypeAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.PermuteInAttributeConv1D]: NNAttributeUpdate,
  [NNElementType.PermuteOutAttributeConv1D]: NNAttributeUpdate,

  [NNElementType.Conv2DLayer]: NNComponentUpdate,
  // Conv2D Attributes
  [NNElementType.NameAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.KernelDimAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.OutChannelsAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.StrideDimAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.InChannelsAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.PaddingAmountAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.PaddingTypeAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.PermuteInAttributeConv2D]: NNAttributeUpdate,
  [NNElementType.PermuteOutAttributeConv2D]: NNAttributeUpdate,

  [NNElementType.Conv3DLayer]: NNComponentUpdate,
  // Conv3D Attributes
  [NNElementType.NameAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.KernelDimAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.OutChannelsAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.StrideDimAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.InChannelsAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.PaddingAmountAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.PaddingTypeAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.PermuteInAttributeConv3D]: NNAttributeUpdate,
  [NNElementType.PermuteOutAttributeConv3D]: NNAttributeUpdate,

  [NNElementType.PoolingLayer]: NNComponentUpdate,
  // Pooling Attributes
  [NNElementType.NameAttributePooling]: NNAttributeUpdate,
  [NNElementType.PoolingTypeAttributePooling]: NNAttributeUpdate,
  [NNElementType.DimensionAttributePooling]: NNAttributeUpdate,
  [NNElementType.KernelDimAttributePooling]: NNAttributeUpdate,
  [NNElementType.StrideDimAttributePooling]: NNAttributeUpdate,
  [NNElementType.PaddingAmountAttributePooling]: NNAttributeUpdate,
  [NNElementType.PaddingTypeAttributePooling]: NNAttributeUpdate,
  [NNElementType.OutputDimAttributePooling]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributePooling]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributePooling]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributePooling]: NNAttributeUpdate,
  [NNElementType.PermuteInAttributePooling]: NNAttributeUpdate,
  [NNElementType.PermuteOutAttributePooling]: NNAttributeUpdate,

  [NNElementType.RNNLayer]: NNComponentUpdate,
  // RNN Attributes
  [NNElementType.NameAttributeRNN]: NNAttributeUpdate,
  [NNElementType.HiddenSizeAttributeRNN]: NNAttributeUpdate,
  [NNElementType.ReturnTypeAttributeRNN]: NNAttributeUpdate,
  [NNElementType.InputSizeAttributeRNN]: NNAttributeUpdate,
  [NNElementType.BidirectionalAttributeRNN]: NNAttributeUpdate,
  [NNElementType.DropoutAttributeRNN]: NNAttributeUpdate,
  [NNElementType.BatchFirstAttributeRNN]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeRNN]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeRNN]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeRNN]: NNAttributeUpdate,

  [NNElementType.LSTMLayer]: NNComponentUpdate,
  // LSTM Attributes
  [NNElementType.NameAttributeLSTM]: NNAttributeUpdate,
  [NNElementType.HiddenSizeAttributeLSTM]: NNAttributeUpdate,
  [NNElementType.ReturnTypeAttributeLSTM]: NNAttributeUpdate,
  [NNElementType.InputSizeAttributeLSTM]: NNAttributeUpdate,
  [NNElementType.BidirectionalAttributeLSTM]: NNAttributeUpdate,
  [NNElementType.DropoutAttributeLSTM]: NNAttributeUpdate,
  [NNElementType.BatchFirstAttributeLSTM]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeLSTM]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeLSTM]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeLSTM]: NNAttributeUpdate,

  [NNElementType.GRULayer]: NNComponentUpdate,
  // GRU Attributes
  [NNElementType.NameAttributeGRU]: NNAttributeUpdate,
  [NNElementType.HiddenSizeAttributeGRU]: NNAttributeUpdate,
  [NNElementType.ReturnTypeAttributeGRU]: NNAttributeUpdate,
  [NNElementType.InputSizeAttributeGRU]: NNAttributeUpdate,
  [NNElementType.BidirectionalAttributeGRU]: NNAttributeUpdate,
  [NNElementType.DropoutAttributeGRU]: NNAttributeUpdate,
  [NNElementType.BatchFirstAttributeGRU]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeGRU]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeGRU]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeGRU]: NNAttributeUpdate,

  [NNElementType.LinearLayer]: NNComponentUpdate,
  // Linear Attributes
  [NNElementType.NameAttributeLinear]: NNAttributeUpdate,
  [NNElementType.OutFeaturesAttributeLinear]: NNAttributeUpdate,
  [NNElementType.InFeaturesAttributeLinear]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeLinear]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeLinear]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeLinear]: NNAttributeUpdate,

  [NNElementType.FlattenLayer]: NNComponentUpdate,
  // Flatten Attributes
  [NNElementType.NameAttributeFlatten]: NNAttributeUpdate,
  [NNElementType.StartDimAttributeFlatten]: NNAttributeUpdate,
  [NNElementType.EndDimAttributeFlatten]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeFlatten]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeFlatten]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeFlatten]: NNAttributeUpdate,

  [NNElementType.EmbeddingLayer]: NNComponentUpdate,
  // Embedding Attributes
  [NNElementType.NameAttributeEmbedding]: NNAttributeUpdate,
  [NNElementType.NumEmbeddingsAttributeEmbedding]: NNAttributeUpdate,
  [NNElementType.EmbeddingDimAttributeEmbedding]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeEmbedding]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeEmbedding]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeEmbedding]: NNAttributeUpdate,

  [NNElementType.DropoutLayer]: NNComponentUpdate,
  // Dropout Attributes
  [NNElementType.NameAttributeDropout]: NNAttributeUpdate,
  [NNElementType.RateAttributeDropout]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeDropout]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeDropout]: NNAttributeUpdate,

  [NNElementType.LayerNormalizationLayer]: NNComponentUpdate,
  // LayerNormalization Attributes
  [NNElementType.NameAttributeLayerNormalization]: NNAttributeUpdate,
  [NNElementType.NormalizedShapeAttributeLayerNormalization]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeLayerNormalization]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeLayerNormalization]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeLayerNormalization]: NNAttributeUpdate,

  [NNElementType.BatchNormalizationLayer]: NNComponentUpdate,
  // BatchNormalization Attributes
  [NNElementType.NameAttributeBatchNormalization]: NNAttributeUpdate,
  [NNElementType.NumFeaturesAttributeBatchNormalization]: NNAttributeUpdate,
  [NNElementType.DimensionAttributeBatchNormalization]: NNAttributeUpdate,
  [NNElementType.ActvFuncAttributeBatchNormalization]: NNAttributeUpdate,
  [NNElementType.NameModuleInputAttributeBatchNormalization]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeBatchNormalization]: NNAttributeUpdate,

  [NNElementType.TensorOp]: NNComponentUpdate,
  // TensorOp Attributes
  [NNElementType.NameAttributeTensorOp]: NNAttributeUpdate,
  [NNElementType.TnsTypeAttributeTensorOp]: NNAttributeUpdate,
  [NNElementType.ConcatenateDimAttributeTensorOp]: NNAttributeUpdate,
  [NNElementType.LayersOfTensorsAttributeTensorOp]: NNAttributeUpdate,
  [NNElementType.ReshapeDimAttributeTensorOp]: NNAttributeUpdate,
  [NNElementType.TransposeDimAttributeTensorOp]: NNAttributeUpdate,
  [NNElementType.PermuteDimAttributeTensorOp]: NNAttributeUpdate,
  [NNElementType.InputReusedAttributeTensorOp]: NNAttributeUpdate,

  [NNElementType.Configuration]: NNComponentUpdate,
  // Configuration Attributes
  [NNElementType.BatchSizeAttributeConfiguration]: NNAttributeUpdate,
  [NNElementType.EpochsAttributeConfiguration]: NNAttributeUpdate,
  [NNElementType.LearningRateAttributeConfiguration]: NNAttributeUpdate,
  [NNElementType.OptimizerAttributeConfiguration]: NNAttributeUpdate,
  [NNElementType.LossFunctionAttributeConfiguration]: NNAttributeUpdate,
  [NNElementType.MetricsAttributeConfiguration]: NNAttributeUpdate,
  [NNElementType.WeightDecayAttributeConfiguration]: NNAttributeUpdate,
  [NNElementType.MomentumAttributeConfiguration]: NNAttributeUpdate,

  // Section elements for sidebar organization (no popups needed)
  [NNElementType.NNSectionTitle]: null,
  [NNElementType.NNSectionSeparator]: null,

  // Container and Reference elements
  [NNElementType.NNContainer]: DefaultPopup,
  [NNElementType.NNReference]: NNReferenceUpdate,

  [UMLRelationshipType.NNNext]: null,
  [UMLRelationshipType.NNComposition]: null,
};
