import { UMLActivityActionNode } from './uml-activity-diagram/uml-activity-action-node/uml-activity-action-node';
import { UMLActivityFinalNode } from './uml-activity-diagram/uml-activity-final-node/uml-activity-final-node';
import { UMLActivityForkNode } from './uml-activity-diagram/uml-activity-fork-node/uml-activity-fork-node';
import { UMLActivityForkNodeHorizontal } from './uml-activity-diagram/uml-activity-fork-node-horizontal/uml-activity-fork-node-horizontal';
import { UMLActivityInitialNode } from './uml-activity-diagram/uml-activity-initial-node/uml-activity-initial-node';
import { UMLActivityMergeNode } from './uml-activity-diagram/uml-activity-merge-node/uml-activity-merge-node';
import { UMLActivityObjectNode } from './uml-activity-diagram/uml-activity-object-node/uml-activity-object-node';
import { UMLActivity } from './uml-activity-diagram/uml-activity/uml-activity';
import { UMLAbstractClass } from './uml-class-diagram/uml-abstract-class/uml-abstract-class';
import { UMLClassAttribute } from './uml-class-diagram/uml-class-attribute/uml-class-attribute';
import { UMLClassMethod } from './uml-class-diagram/uml-class-method/uml-class-method';
import { UMLClassPackage } from './uml-class-diagram/uml-class-package/uml-class-package';
import { UMLClass } from './uml-class-diagram/uml-class/uml-class';
import { UMLEnumeration } from './uml-class-diagram/uml-enumeration/uml-enumeration';
import { UMLInterface } from './uml-class-diagram/uml-interface/uml-interface';
import { UMLComponentInterface } from './uml-component-diagram/uml-component-interface/uml-component-interface';
import { UMLDeploymentArtifact } from './uml-deployment-diagram/uml-deployment-artifact/uml-deployment-artifact';
import { UMLDeploymentNode } from './uml-deployment-diagram/uml-deployment-node/uml-deployment-node';
import { UMLElementType } from './uml-element-type';
import { UMLObjectAttribute } from './uml-object-diagram/uml-object-attribute/uml-object-attribute';
import { UMLObjectMethod } from './uml-object-diagram/uml-object-method/uml-object-method';
import { UMLObjectName } from './uml-object-diagram/uml-object-name/uml-object-name';
import { UMLObjectIcon } from './uml-object-diagram/uml-object-icon/uml-object-icon';
import { UMLUserModelAttribute } from './user-modeling/uml-user-model-attribute/uml-user-model-attribute';
import { UMLUserModelIcon } from './user-modeling/uml-user-model-icon/uml-user-model-icon';
import { UMLUserModelName } from './user-modeling/uml-user-model-name/uml-user-model-name';
import { UMLUseCaseActor } from './uml-use-case-diagram/uml-use-case-actor/uml-use-case-actor';
import { UMLUseCaseSystem } from './uml-use-case-diagram/uml-use-case-system/uml-use-case-system';
import { UMLUseCase } from './uml-use-case-diagram/uml-use-case/uml-use-case';
import { UMLDeploymentInterface } from './uml-deployment-diagram/uml-deployment-interface/uml-component-interface';
import { UMLPetriNetTransition } from './uml-petri-net/uml-petri-net-transition/uml-petri-net-transition';
import { UMLPetriNetPlace } from './uml-petri-net/uml-petri-net-place/uml-petri-net-place';
import { UMLReachabilityGraphMarking } from './uml-reachability-graph/uml-reachability-graph-marking/uml-reachability-graph-marking';
import { CommunicationLinkMessage } from './uml-communication-diagram/uml-communication-link/uml-communiction-link-message';
import { UMLDeploymentComponent } from './uml-deployment-diagram/uml-deployment-component/uml-component';
import { UMLComponentComponent } from './uml-component-diagram/uml-component/uml-component-component';
import { UMLSubsystem } from './uml-component-diagram/uml-component-subsystem/uml-component-subsystem';
import { SyntaxTreeTerminal } from './syntax-tree/syntax-tree-terminal/syntax-tree-terminal';
import { SyntaxTreeNonterminal } from './syntax-tree/syntax-tree-nonterminal/syntax-tree-nonterminal';
import { FlowchartTerminal } from './flowchart/flowchart-terminal/flowchart-terminal';
import { FlowchartFunctionCall } from './flowchart/flowchart-function-call/flowchart-function-call';
import { FlowchartDecision } from './flowchart/flowchart-decision/flowchart-decision';
import { FlowchartProcess } from './flowchart/flowchart-process/flowchart-process';
import { FlowchartInputOutput } from './flowchart/flowchart-input-output/flowchart-input-output';
import { ColorLegend } from './common/color-legend/color-legend';
import { Comments } from './common/comments/comments';

import { BPMNTask } from './bpmn/bpmn-task/bpmn-task';
import { BPMNSubprocess } from './bpmn/bpmn-subprocess/bpmn-subprocess';
import { BPMNStartEvent } from './bpmn/bpmn-start-event/bpmn-start-event';
import { BPMNIntermediateEvent } from './bpmn/bpmn-intermediate-event/bpmn-intermediate-event';
import { BPMNEndEvent } from './bpmn/bpmn-end-event/bpmn-end-event';
import { BPMNGateway } from './bpmn/bpmn-gateway/bpmn-gateway';
import { BPMNTransaction } from './bpmn/bpmn-transaction/bpmn-transaction';
import { BPMNCallActivity } from './bpmn/bpmn-call-activity/bpmn-call-activity';
import { BPMNAnnotation } from './bpmn/bpmn-annotation/bpmn-annotation';
import { BPMNDataObject } from './bpmn/bpmn-data-object/bpmn-data-object';
import { BPMNPool } from './bpmn/bpmn-pool/bpmn-pool';
import { BPMNSwimlane } from './bpmn/bpmn-swimlane/bpmn-swimlane';
import { BPMNGroup } from './bpmn/bpmn-group/bpmn-group';
import { BPMNDataStore } from './bpmn/bpmn-data-store/bpmn-data-store';
import { ClassOCLConstraint } from './uml-class-diagram/uml-class-ocl/uml-class-ocl-constraint';
import { UMLState } from './uml-state-diagram/uml-state/uml-state';
import { UMLStateBody } from './uml-state-diagram/uml-state-body/uml-state-body';
import { UMLStateFallbackBody } from './uml-state-diagram/uml-state-fallback_body/uml-state-fallback_body';
import { UMLStateActionNode } from './uml-state-diagram/uml-state-action-node/uml-state-action-node';
import { UMLStateFinalNode } from './uml-state-diagram/uml-state-final-node/uml-state-final-node';
import { UMLStateForkNode } from './uml-state-diagram/uml-state-fork-node/uml-state-fork-node';
import { UMLStateForkNodeHorizontal } from './uml-state-diagram/uml-state-fork-node-horizontal/uml-state-fork-node-horizontal';
import { UMLStateInitialNode } from './uml-state-diagram/uml-state-initial-node/uml-state-initial-node';
import { UMLStateMergeNode } from './uml-state-diagram/uml-state-merge-node/uml-state-merge-node';
import { UMLStateObjectNode } from './uml-state-diagram/uml-state-object-node/uml-state-object-node';
import { UMLStateCodeBlock } from './uml-state-diagram/uml-state-code-block/uml-state-code-block';

import { AgentIntent } from './agent-state-diagram/agent-intent-object-component/agent-intent';
import { AgentIntentBody } from './agent-state-diagram/agent-intent-body/agent-intent-body';
import { AgentRagElement } from './agent-state-diagram/agent-rag-element/agent-rag-element';
import { AgentState } from './agent-state-diagram/agent-state/agent-state';
import { AgentStateBody } from './agent-state-diagram/agent-state-body/agent-state-body';
import { AgentStateFallbackBody } from './agent-state-diagram/agent-state-fallback-body/agent-state-fallback-body';

import { NNElementType } from './nn-diagram';
import { Conv1DLayer } from './nn-diagram/nn-conv1d-layer/nn-conv1d-layer';
import {
  NameAttributeConv1D,
  KernelDimAttributeConv1D,
  OutChannelsAttributeConv1D,
  StrideDimAttributeConv1D,
  InChannelsAttributeConv1D,
  PaddingAmountAttributeConv1D,
  PaddingTypeAttributeConv1D,
  ActvFuncAttributeConv1D,
  NameModuleInputAttributeConv1D,
  InputReusedAttributeConv1D,
  PermuteInAttributeConv1D,
  PermuteOutAttributeConv1D,
} from './nn-diagram/nn-conv1d-attributes/conv1d-attributes';
import { Conv2DLayer } from './nn-diagram/nn-conv2d-layer/nn-conv2d-layer';
import {
  NameAttributeConv2D,
  KernelDimAttributeConv2D,
  OutChannelsAttributeConv2D,
  StrideDimAttributeConv2D,
  InChannelsAttributeConv2D,
  PaddingAmountAttributeConv2D,
  PaddingTypeAttributeConv2D,
  ActvFuncAttributeConv2D,
  NameModuleInputAttributeConv2D,
  InputReusedAttributeConv2D,
  PermuteInAttributeConv2D,
  PermuteOutAttributeConv2D,
} from './nn-diagram/nn-conv2d-attributes/conv2d-attributes';
import { Conv3DLayer } from './nn-diagram/nn-conv3d-layer/nn-conv3d-layer';
import {
  NameAttributeConv3D,
  KernelDimAttributeConv3D,
  OutChannelsAttributeConv3D,
  StrideDimAttributeConv3D,
  InChannelsAttributeConv3D,
  PaddingAmountAttributeConv3D,
  PaddingTypeAttributeConv3D,
  ActvFuncAttributeConv3D,
  NameModuleInputAttributeConv3D,
  InputReusedAttributeConv3D,
  PermuteInAttributeConv3D,
  PermuteOutAttributeConv3D,
} from './nn-diagram/nn-conv3d-attributes/conv3d-attributes';

import { PoolingLayer } from './nn-diagram/nn-pooling-layer/nn-pooling-layer';
import {
  NameAttributePooling,
  PoolingTypeAttributePooling,
  DimensionAttributePooling,
  KernelDimAttributePooling,
  StrideDimAttributePooling,
  PaddingAmountAttributePooling,
  PaddingTypeAttributePooling,
  OutputDimAttributePooling,
  ActvFuncAttributePooling,
  NameModuleInputAttributePooling,
  InputReusedAttributePooling,
  PermuteInAttributePooling,
  PermuteOutAttributePooling,
} from './nn-diagram/nn-pooling-attributes/pooling-attributes';

import { RNNLayer } from './nn-diagram/nn-rnn-layer/nn-rnn-layer';
import {
  NameAttributeRNN,
  HiddenSizeAttributeRNN,
  ReturnTypeAttributeRNN,
  InputSizeAttributeRNN,
  BidirectionalAttributeRNN,
  DropoutAttributeRNN,
  BatchFirstAttributeRNN,
  ActvFuncAttributeRNN,
  NameModuleInputAttributeRNN,
  InputReusedAttributeRNN,
} from './nn-diagram/nn-rnn-attributes/rnn-attributes';

import { LSTMLayer } from './nn-diagram/nn-lstm-layer/nn-lstm-layer';
import {
  NameAttributeLSTM,
  HiddenSizeAttributeLSTM,
  ReturnTypeAttributeLSTM,
  InputSizeAttributeLSTM,
  BidirectionalAttributeLSTM,
  DropoutAttributeLSTM,
  BatchFirstAttributeLSTM,
  ActvFuncAttributeLSTM,
  NameModuleInputAttributeLSTM,
  InputReusedAttributeLSTM,
} from './nn-diagram/nn-lstm-attributes/lstm-attributes';

import { GRULayer } from './nn-diagram/nn-gru-layer/nn-gru-layer';
import {
  NameAttributeGRU,
  HiddenSizeAttributeGRU,
  ReturnTypeAttributeGRU,
  InputSizeAttributeGRU,
  BidirectionalAttributeGRU,
  DropoutAttributeGRU,
  BatchFirstAttributeGRU,
  ActvFuncAttributeGRU,
  NameModuleInputAttributeGRU,
  InputReusedAttributeGRU,
} from './nn-diagram/nn-gru-attributes/gru-attributes';

import { LinearLayer } from './nn-diagram/nn-linear-layer/nn-linear-layer';
import {
  NameAttributeLinear,
  OutFeaturesAttributeLinear,
  InFeaturesAttributeLinear,
  ActvFuncAttributeLinear,
  NameModuleInputAttributeLinear,
  InputReusedAttributeLinear,
} from './nn-diagram/nn-linear-attributes/linear-attributes';

import { FlattenLayer } from './nn-diagram/nn-flatten-layer/nn-flatten-layer';
import {
  NameAttributeFlatten,
  StartDimAttributeFlatten,
  EndDimAttributeFlatten,
  ActvFuncAttributeFlatten,
  NameModuleInputAttributeFlatten,
  InputReusedAttributeFlatten,
} from './nn-diagram/nn-flatten-attributes/flatten-attributes';

import { EmbeddingLayer } from './nn-diagram/nn-embedding-layer/nn-embedding-layer';
import {
  NameAttributeEmbedding,
  NumEmbeddingsAttributeEmbedding,
  EmbeddingDimAttributeEmbedding,
  ActvFuncAttributeEmbedding,
  NameModuleInputAttributeEmbedding,
  InputReusedAttributeEmbedding,
} from './nn-diagram/nn-embedding-attributes/embedding-attributes';

import { DropoutLayer } from './nn-diagram/nn-dropout-layer/nn-dropout-layer';
import {
  NameAttributeDropout,
  RateAttributeDropout,
  NameModuleInputAttributeDropout,
  InputReusedAttributeDropout,
} from './nn-diagram/nn-dropout-attributes/dropout-attributes';

import { LayerNormalizationLayer } from './nn-diagram/nn-layernormalization-layer/nn-layernormalization';
import {
  NameAttributeLayerNormalization,
  NormalizedShapeAttributeLayerNormalization,
  ActvFuncAttributeLayerNormalization,
  NameModuleInputAttributeLayerNormalization,
  InputReusedAttributeLayerNormalization,
} from './nn-diagram/nn-layernormalization-attributes/layernormalization-attributes';

import { BatchNormalizationLayer } from './nn-diagram/nn-batchnormalization-layer/nn-batchnormalization-layer';
import {
  NameAttributeBatchNormalization,
  NumFeaturesAttributeBatchNormalization,
  DimensionAttributeBatchNormalization,
  ActvFuncAttributeBatchNormalization,
  NameModuleInputAttributeBatchNormalization,
  InputReusedAttributeBatchNormalization,
} from './nn-diagram/nn-batchnormalization-attributes/batchnormalization-attributes';

import { TensorOp } from './nn-diagram/nn-tensorop/nn-tensorop';
import {
  NameAttributeTensorOp,
  TnsTypeAttributeTensorOp,
  ConcatenateDimAttributeTensorOp,
  LayersOfTensorsAttributeTensorOp,
  ReshapeDimAttributeTensorOp,
  TransposeDimAttributeTensorOp,
  PermuteDimAttributeTensorOp,
  InputReusedAttributeTensorOp,
  TensorOpAttribute,
} from './nn-diagram/nn-tensorop-attributes/tensorop-attributes';

import { Configuration } from './nn-diagram/nn-configuration/nn-configuration';
import { NNSectionTitle, NNSectionSeparator } from './nn-diagram/nn-section-elements';
import { NNContainer } from './nn-diagram/nn-container/nn-container';
import { NNReference } from './nn-diagram/nn-reference/nn-reference';
import {
  BatchSizeAttributeConfiguration,
  EpochsAttributeConfiguration,
  LearningRateAttributeConfiguration,
  OptimizerAttributeConfiguration,
  LossFunctionAttributeConfiguration,
  MetricsAttributeConfiguration,
  WeightDecayAttributeConfiguration,
  MomentumAttributeConfiguration,
  ConfigurationAttribute,
} from './nn-diagram/nn-configuration-attributes/configuration-attributes';

export const UMLElements = {
  [UMLElementType.Package]: UMLClassPackage,
  [UMLElementType.Class]: UMLClass,
  [UMLElementType.AbstractClass]: UMLAbstractClass,
  [UMLElementType.Interface]: UMLInterface,
  [UMLElementType.Enumeration]: UMLEnumeration,
  [UMLElementType.ClassAttribute]: UMLClassAttribute,
  [UMLElementType.ClassMethod]: UMLClassMethod,
  [UMLElementType.ClassOCLConstraint]: ClassOCLConstraint,
  [UMLElementType.ObjectName]: UMLObjectName,
  [UMLElementType.ObjectAttribute]: UMLObjectAttribute,
  [UMLElementType.ObjectMethod]: UMLObjectMethod,
  [UMLElementType.ObjectIcon]: UMLObjectIcon,
  [UMLElementType.UserModelName]: UMLUserModelName,
  [UMLElementType.UserModelAttribute]: UMLUserModelAttribute,
  [UMLElementType.UserModelIcon]: UMLUserModelIcon,
  [UMLElementType.Activity]: UMLActivity,
  [UMLElementType.ActivityInitialNode]: UMLActivityInitialNode,
  [UMLElementType.ActivityFinalNode]: UMLActivityFinalNode,
  [UMLElementType.ActivityActionNode]: UMLActivityActionNode,
  [UMLElementType.ActivityObjectNode]: UMLActivityObjectNode,
  [UMLElementType.ActivityForkNode]: UMLActivityForkNode,
  [UMLElementType.ActivityForkNodeHorizontal]: UMLActivityForkNodeHorizontal,
  [UMLElementType.ActivityMergeNode]: UMLActivityMergeNode,
  [UMLElementType.UseCase]: UMLUseCase,
  [UMLElementType.UseCaseActor]: UMLUseCaseActor,
  [UMLElementType.UseCaseSystem]: UMLUseCaseSystem,
  [UMLElementType.Component]: UMLComponentComponent,
  [UMLElementType.Subsystem]: UMLSubsystem,
  [UMLElementType.ComponentInterface]: UMLComponentInterface,
  [UMLElementType.DeploymentNode]: UMLDeploymentNode,
  [UMLElementType.DeploymentComponent]: UMLDeploymentComponent,
  [UMLElementType.DeploymentArtifact]: UMLDeploymentArtifact,
  [UMLElementType.DeploymentInterface]: UMLDeploymentInterface,
  [UMLElementType.PetriNetPlace]: UMLPetriNetPlace,
  [UMLElementType.PetriNetTransition]: UMLPetriNetTransition,
  [UMLElementType.ReachabilityGraphMarking]: UMLReachabilityGraphMarking,
  [UMLElementType.CommunicationLinkMessage]: CommunicationLinkMessage,
  [UMLElementType.SyntaxTreeTerminal]: SyntaxTreeTerminal,
  [UMLElementType.SyntaxTreeNonterminal]: SyntaxTreeNonterminal,
  [UMLElementType.FlowchartTerminal]: FlowchartTerminal,
  [UMLElementType.FlowchartFunctionCall]: FlowchartFunctionCall,
  [UMLElementType.FlowchartProcess]: FlowchartProcess,
  [UMLElementType.FlowchartDecision]: FlowchartDecision,
  [UMLElementType.FlowchartInputOutput]: FlowchartInputOutput,
  [UMLElementType.ColorLegend]: ColorLegend,
  [UMLElementType.Comments]: Comments,
  [UMLElementType.BPMNTask]: BPMNTask,
  [UMLElementType.BPMNSubprocess]: BPMNSubprocess,
  [UMLElementType.BPMNTransaction]: BPMNTransaction,
  [UMLElementType.BPMNCallActivity]: BPMNCallActivity,
  [UMLElementType.BPMNAnnotation]: BPMNAnnotation,
  [UMLElementType.BPMNStartEvent]: BPMNStartEvent,
  [UMLElementType.BPMNIntermediateEvent]: BPMNIntermediateEvent,
  [UMLElementType.BPMNEndEvent]: BPMNEndEvent,
  [UMLElementType.BPMNGateway]: BPMNGateway,
  [UMLElementType.BPMNDataObject]: BPMNDataObject,
  [UMLElementType.BPMNDataStore]: BPMNDataStore,
  [UMLElementType.BPMNPool]: BPMNPool,
  [UMLElementType.BPMNSwimlane]: BPMNSwimlane,
  [UMLElementType.BPMNGroup]: BPMNGroup,
  [UMLElementType.State]: UMLState,
  [UMLElementType.StateBody]: UMLStateBody,
  [UMLElementType.StateFallbackBody]: UMLStateFallbackBody,
  [UMLElementType.StateInitialNode]: UMLStateInitialNode,
  [UMLElementType.StateFinalNode]: UMLStateFinalNode,
  [UMLElementType.StateActionNode]: UMLStateActionNode,
  [UMLElementType.StateForkNode]: UMLStateForkNode,
  [UMLElementType.StateForkNodeHorizontal]: UMLStateForkNodeHorizontal,
  [UMLElementType.StateMergeNode]: UMLStateMergeNode,
  [UMLElementType.StateObjectNode]: UMLStateObjectNode,
  [UMLElementType.StateCodeBlock]: UMLStateCodeBlock,
  [UMLElementType.AgentIntent]: AgentIntent,
  [UMLElementType.AgentIntentBody]: AgentIntentBody,
  [UMLElementType.AgentRagElement]: AgentRagElement,
  [UMLElementType.AgentState]: AgentState,
  [UMLElementType.AgentStateBody]: AgentStateBody,
  [UMLElementType.AgentStateFallbackBody]: AgentStateFallbackBody,
  [NNElementType.Conv1DLayer]: Conv1DLayer,
  // Conv1D Attributes - Mandatory
  [NNElementType.NameAttributeConv1D]: NameAttributeConv1D,
  [NNElementType.KernelDimAttributeConv1D]: KernelDimAttributeConv1D,
  [NNElementType.OutChannelsAttributeConv1D]: OutChannelsAttributeConv1D,
  // Conv1D Attributes - Optional
  [NNElementType.StrideDimAttributeConv1D]: StrideDimAttributeConv1D,
  [NNElementType.InChannelsAttributeConv1D]: InChannelsAttributeConv1D,
  [NNElementType.PaddingAmountAttributeConv1D]: PaddingAmountAttributeConv1D,
  [NNElementType.PaddingTypeAttributeConv1D]: PaddingTypeAttributeConv1D,
  [NNElementType.ActvFuncAttributeConv1D]: ActvFuncAttributeConv1D,
  [NNElementType.NameModuleInputAttributeConv1D]: NameModuleInputAttributeConv1D,
  [NNElementType.InputReusedAttributeConv1D]: InputReusedAttributeConv1D,
  [NNElementType.PermuteInAttributeConv1D]: PermuteInAttributeConv1D,
  [NNElementType.PermuteOutAttributeConv1D]: PermuteOutAttributeConv1D,

  [NNElementType.Conv2DLayer]: Conv2DLayer,
  // Conv2D Attributes - Mandatory
  [NNElementType.NameAttributeConv2D]: NameAttributeConv2D,
  [NNElementType.KernelDimAttributeConv2D]: KernelDimAttributeConv2D,
  [NNElementType.OutChannelsAttributeConv2D]: OutChannelsAttributeConv2D,
  // Conv2D Attributes - Optional
  [NNElementType.StrideDimAttributeConv2D]: StrideDimAttributeConv2D,
  [NNElementType.InChannelsAttributeConv2D]: InChannelsAttributeConv2D,
  [NNElementType.PaddingAmountAttributeConv2D]: PaddingAmountAttributeConv2D,
  [NNElementType.PaddingTypeAttributeConv2D]: PaddingTypeAttributeConv2D,
  [NNElementType.ActvFuncAttributeConv2D]: ActvFuncAttributeConv2D,
  [NNElementType.NameModuleInputAttributeConv2D]: NameModuleInputAttributeConv2D,
  [NNElementType.InputReusedAttributeConv2D]: InputReusedAttributeConv2D,
  [NNElementType.PermuteInAttributeConv2D]: PermuteInAttributeConv2D,
  [NNElementType.PermuteOutAttributeConv2D]: PermuteOutAttributeConv2D,

  [NNElementType.Conv3DLayer]: Conv3DLayer,
  // Conv3D Attributes - Mandatory
  [NNElementType.NameAttributeConv3D]: NameAttributeConv3D,
  [NNElementType.KernelDimAttributeConv3D]: KernelDimAttributeConv3D,
  [NNElementType.OutChannelsAttributeConv3D]: OutChannelsAttributeConv3D,
  // Conv3D Attributes - Optional
  [NNElementType.StrideDimAttributeConv3D]: StrideDimAttributeConv3D,
  [NNElementType.InChannelsAttributeConv3D]: InChannelsAttributeConv3D,
  [NNElementType.PaddingAmountAttributeConv3D]: PaddingAmountAttributeConv3D,
  [NNElementType.PaddingTypeAttributeConv3D]: PaddingTypeAttributeConv3D,
  [NNElementType.ActvFuncAttributeConv3D]: ActvFuncAttributeConv3D,
  [NNElementType.NameModuleInputAttributeConv3D]: NameModuleInputAttributeConv3D,
  [NNElementType.InputReusedAttributeConv3D]: InputReusedAttributeConv3D,
  [NNElementType.PermuteInAttributeConv3D]: PermuteInAttributeConv3D,
  [NNElementType.PermuteOutAttributeConv3D]: PermuteOutAttributeConv3D,

  [NNElementType.PoolingLayer]: PoolingLayer,
  // Pooling Attributes - Mandatory
  [NNElementType.NameAttributePooling]: NameAttributePooling,
  [NNElementType.PoolingTypeAttributePooling]: PoolingTypeAttributePooling,
  [NNElementType.DimensionAttributePooling]: DimensionAttributePooling,
  // Pooling Attributes - Optional
  [NNElementType.KernelDimAttributePooling]: KernelDimAttributePooling,
  [NNElementType.StrideDimAttributePooling]: StrideDimAttributePooling,
  [NNElementType.PaddingAmountAttributePooling]: PaddingAmountAttributePooling,
  [NNElementType.PaddingTypeAttributePooling]: PaddingTypeAttributePooling,
  [NNElementType.OutputDimAttributePooling]: OutputDimAttributePooling,
  [NNElementType.ActvFuncAttributePooling]: ActvFuncAttributePooling,
  [NNElementType.NameModuleInputAttributePooling]: NameModuleInputAttributePooling,
  [NNElementType.InputReusedAttributePooling]: InputReusedAttributePooling,
  [NNElementType.PermuteInAttributePooling]: PermuteInAttributePooling,
  [NNElementType.PermuteOutAttributePooling]: PermuteOutAttributePooling,

  [NNElementType.RNNLayer]: RNNLayer,
  // RNN Attributes - Mandatory
  [NNElementType.NameAttributeRNN]: NameAttributeRNN,
  [NNElementType.HiddenSizeAttributeRNN]: HiddenSizeAttributeRNN,
  // RNN Attributes - Optional
  [NNElementType.ReturnTypeAttributeRNN]: ReturnTypeAttributeRNN,
  [NNElementType.InputSizeAttributeRNN]: InputSizeAttributeRNN,
  [NNElementType.BidirectionalAttributeRNN]: BidirectionalAttributeRNN,
  [NNElementType.DropoutAttributeRNN]: DropoutAttributeRNN,
  [NNElementType.BatchFirstAttributeRNN]: BatchFirstAttributeRNN,
  [NNElementType.ActvFuncAttributeRNN]: ActvFuncAttributeRNN,
  [NNElementType.NameModuleInputAttributeRNN]: NameModuleInputAttributeRNN,
  [NNElementType.InputReusedAttributeRNN]: InputReusedAttributeRNN,

  [NNElementType.LSTMLayer]: LSTMLayer,
  // LSTM Attributes - Mandatory
  [NNElementType.NameAttributeLSTM]: NameAttributeLSTM,
  [NNElementType.HiddenSizeAttributeLSTM]: HiddenSizeAttributeLSTM,
  // LSTM Attributes - Optional
  [NNElementType.ReturnTypeAttributeLSTM]: ReturnTypeAttributeLSTM,
  [NNElementType.InputSizeAttributeLSTM]: InputSizeAttributeLSTM,
  [NNElementType.BidirectionalAttributeLSTM]: BidirectionalAttributeLSTM,
  [NNElementType.DropoutAttributeLSTM]: DropoutAttributeLSTM,
  [NNElementType.BatchFirstAttributeLSTM]: BatchFirstAttributeLSTM,
  [NNElementType.ActvFuncAttributeLSTM]: ActvFuncAttributeLSTM,
  [NNElementType.NameModuleInputAttributeLSTM]: NameModuleInputAttributeLSTM,
  [NNElementType.InputReusedAttributeLSTM]: InputReusedAttributeLSTM,

  [NNElementType.GRULayer]: GRULayer,
  // GRU Attributes - Mandatory
  [NNElementType.NameAttributeGRU]: NameAttributeGRU,
  [NNElementType.HiddenSizeAttributeGRU]: HiddenSizeAttributeGRU,
  // GRU Attributes - Optional
  [NNElementType.ReturnTypeAttributeGRU]: ReturnTypeAttributeGRU,
  [NNElementType.InputSizeAttributeGRU]: InputSizeAttributeGRU,
  [NNElementType.BidirectionalAttributeGRU]: BidirectionalAttributeGRU,
  [NNElementType.DropoutAttributeGRU]: DropoutAttributeGRU,
  [NNElementType.BatchFirstAttributeGRU]: BatchFirstAttributeGRU,
  [NNElementType.ActvFuncAttributeGRU]: ActvFuncAttributeGRU,
  [NNElementType.NameModuleInputAttributeGRU]: NameModuleInputAttributeGRU,
  [NNElementType.InputReusedAttributeGRU]: InputReusedAttributeGRU,

  [NNElementType.LinearLayer]: LinearLayer,
  // Linear Attributes - Mandatory
  [NNElementType.NameAttributeLinear]: NameAttributeLinear,
  [NNElementType.OutFeaturesAttributeLinear]: OutFeaturesAttributeLinear,
  // Linear Attributes - Optional
  [NNElementType.InFeaturesAttributeLinear]: InFeaturesAttributeLinear,
  [NNElementType.ActvFuncAttributeLinear]: ActvFuncAttributeLinear,
  [NNElementType.NameModuleInputAttributeLinear]: NameModuleInputAttributeLinear,
  [NNElementType.InputReusedAttributeLinear]: InputReusedAttributeLinear,

  [NNElementType.FlattenLayer]: FlattenLayer,
  // Flatten Attributes - Mandatory
  [NNElementType.NameAttributeFlatten]: NameAttributeFlatten,
  // Flatten Attributes - Optional
  [NNElementType.StartDimAttributeFlatten]: StartDimAttributeFlatten,
  [NNElementType.EndDimAttributeFlatten]: EndDimAttributeFlatten,
  [NNElementType.ActvFuncAttributeFlatten]: ActvFuncAttributeFlatten,
  [NNElementType.NameModuleInputAttributeFlatten]: NameModuleInputAttributeFlatten,
  [NNElementType.InputReusedAttributeFlatten]: InputReusedAttributeFlatten,

  [NNElementType.EmbeddingLayer]: EmbeddingLayer,
  // Embedding Attributes - Mandatory
  [NNElementType.NameAttributeEmbedding]: NameAttributeEmbedding,
  [NNElementType.NumEmbeddingsAttributeEmbedding]: NumEmbeddingsAttributeEmbedding,
  [NNElementType.EmbeddingDimAttributeEmbedding]: EmbeddingDimAttributeEmbedding,
  // Embedding Attributes - Optional
  [NNElementType.ActvFuncAttributeEmbedding]: ActvFuncAttributeEmbedding,
  [NNElementType.NameModuleInputAttributeEmbedding]: NameModuleInputAttributeEmbedding,
  [NNElementType.InputReusedAttributeEmbedding]: InputReusedAttributeEmbedding,

  [NNElementType.DropoutLayer]: DropoutLayer,
  // Dropout Attributes - Mandatory
  [NNElementType.NameAttributeDropout]: NameAttributeDropout,
  [NNElementType.RateAttributeDropout]: RateAttributeDropout,
  // Dropout Attributes - Optional
  [NNElementType.NameModuleInputAttributeDropout]: NameModuleInputAttributeDropout,
  [NNElementType.InputReusedAttributeDropout]: InputReusedAttributeDropout,

  [NNElementType.LayerNormalizationLayer]: LayerNormalizationLayer,
  // LayerNormalization Attributes - Mandatory
  [NNElementType.NameAttributeLayerNormalization]: NameAttributeLayerNormalization,
  [NNElementType.NormalizedShapeAttributeLayerNormalization]: NormalizedShapeAttributeLayerNormalization,
  // LayerNormalization Attributes - Optional
  [NNElementType.ActvFuncAttributeLayerNormalization]: ActvFuncAttributeLayerNormalization,
  [NNElementType.NameModuleInputAttributeLayerNormalization]: NameModuleInputAttributeLayerNormalization,
  [NNElementType.InputReusedAttributeLayerNormalization]: InputReusedAttributeLayerNormalization,

  [NNElementType.BatchNormalizationLayer]: BatchNormalizationLayer,
  // BatchNormalization Attributes - Mandatory
  [NNElementType.NameAttributeBatchNormalization]: NameAttributeBatchNormalization,
  [NNElementType.NumFeaturesAttributeBatchNormalization]: NumFeaturesAttributeBatchNormalization,
  [NNElementType.DimensionAttributeBatchNormalization]: DimensionAttributeBatchNormalization,
  // BatchNormalization Attributes - Optional
  [NNElementType.ActvFuncAttributeBatchNormalization]: ActvFuncAttributeBatchNormalization,
  [NNElementType.NameModuleInputAttributeBatchNormalization]: NameModuleInputAttributeBatchNormalization,
  [NNElementType.InputReusedAttributeBatchNormalization]: InputReusedAttributeBatchNormalization,

  [NNElementType.TensorOp]: TensorOp,
  // TensorOp Attributes - Mandatory
  [NNElementType.NameAttributeTensorOp]: NameAttributeTensorOp,
  [NNElementType.TnsTypeAttributeTensorOp]: TnsTypeAttributeTensorOp,
  // TensorOp Attributes - Optional
  [NNElementType.ConcatenateDimAttributeTensorOp]: ConcatenateDimAttributeTensorOp,
  [NNElementType.LayersOfTensorsAttributeTensorOp]: LayersOfTensorsAttributeTensorOp,
  [NNElementType.ReshapeDimAttributeTensorOp]: ReshapeDimAttributeTensorOp,
  [NNElementType.TransposeDimAttributeTensorOp]: TransposeDimAttributeTensorOp,
  [NNElementType.PermuteDimAttributeTensorOp]: PermuteDimAttributeTensorOp,
  [NNElementType.InputReusedAttributeTensorOp]: InputReusedAttributeTensorOp,

  [NNElementType.Configuration]: Configuration,
  // Configuration Attributes - Mandatory
  [NNElementType.BatchSizeAttributeConfiguration]: BatchSizeAttributeConfiguration,
  [NNElementType.EpochsAttributeConfiguration]: EpochsAttributeConfiguration,
  [NNElementType.LearningRateAttributeConfiguration]: LearningRateAttributeConfiguration,
  [NNElementType.OptimizerAttributeConfiguration]: OptimizerAttributeConfiguration,
  [NNElementType.LossFunctionAttributeConfiguration]: LossFunctionAttributeConfiguration,
  [NNElementType.MetricsAttributeConfiguration]: MetricsAttributeConfiguration,
  // Configuration Attributes - Optional
  [NNElementType.WeightDecayAttributeConfiguration]: WeightDecayAttributeConfiguration,
  [NNElementType.MomentumAttributeConfiguration]: MomentumAttributeConfiguration,

  // Section elements for sidebar organization
  [NNElementType.NNSectionTitle]: NNSectionTitle,
  [NNElementType.NNSectionSeparator]: NNSectionSeparator,

  // Container and Reference elements
  [NNElementType.NNContainer]: NNContainer,
  [NNElementType.NNReference]: NNReference,
};
