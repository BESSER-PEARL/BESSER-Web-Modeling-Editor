import React, { Component, ComponentClass, createRef } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { UMLContainerRepository } from '../../../services/uml-container/uml-container-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { notEmpty } from '../../../utils/not-empty';
import { NNAttributeUpdate } from '../attribute-update/nn-attribute-update';
import { INNAttribute } from '../nn-component-attribute';
import { Conv1DLayer } from '../nn-conv1d-layer/nn-conv1d-layer';
import { Conv2DLayer } from '../nn-conv2d-layer/nn-conv2d-layer';
import { Conv3DLayer } from '../nn-conv3d-layer/nn-conv3d-layer';
import { PoolingLayer } from '../nn-pooling-layer/nn-pooling-layer';
import { RNNLayer } from '../nn-rnn-layer/nn-rnn-layer';
import { LSTMLayer } from '../nn-lstm-layer/nn-lstm-layer';
import { GRULayer } from '../nn-gru-layer/nn-gru-layer';
import { LinearLayer } from '../nn-linear-layer/nn-linear-layer';
import { FlattenLayer } from '../nn-flatten-layer/nn-flatten-layer';
import { EmbeddingLayer } from '../nn-embedding-layer/nn-embedding-layer';
import { DropoutLayer } from '../nn-dropout-layer/nn-dropout-layer';
import { LayerNormalizationLayer } from '../nn-layernormalization-layer/nn-layernormalization';
import { BatchNormalizationLayer } from '../nn-batchnormalization-layer/nn-batchnormalization-layer';
import { TensorOp } from '../nn-tensorop/nn-tensorop';
import { Configuration } from '../nn-configuration/nn-configuration';
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
  Conv1DAttribute,
} from '../nn-conv1d-attributes/conv1d-attributes';
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
  Conv2DAttribute,
} from '../nn-conv2d-attributes/conv2d-attributes';
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
  Conv3DAttribute,
} from '../nn-conv3d-attributes/conv3d-attributes';
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
  PoolingAttribute,
} from '../nn-pooling-attributes/pooling-attributes';
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
  RNNAttribute,
} from '../nn-rnn-attributes/rnn-attributes';
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
  LSTMAttribute,
} from '../nn-lstm-attributes/lstm-attributes';
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
  GRUAttribute,
} from '../nn-gru-attributes/gru-attributes';
import {
  NameAttributeLinear,
  OutFeaturesAttributeLinear,
  InFeaturesAttributeLinear,
  ActvFuncAttributeLinear,
  NameModuleInputAttributeLinear,
  InputReusedAttributeLinear,
  LinearAttribute,
} from '../nn-linear-attributes/linear-attributes';
import {
  NameAttributeFlatten,
  StartDimAttributeFlatten,
  EndDimAttributeFlatten,
  ActvFuncAttributeFlatten,
  NameModuleInputAttributeFlatten,
  InputReusedAttributeFlatten,
  FlattenAttribute,
} from '../nn-flatten-attributes/flatten-attributes';
import {
  NameAttributeEmbedding,
  NumEmbeddingsAttributeEmbedding,
  EmbeddingDimAttributeEmbedding,
  ActvFuncAttributeEmbedding,
  NameModuleInputAttributeEmbedding,
  InputReusedAttributeEmbedding,
  EmbeddingAttribute,
} from '../nn-embedding-attributes/embedding-attributes';
import {
  NameAttributeDropout,
  RateAttributeDropout,
  NameModuleInputAttributeDropout,
  InputReusedAttributeDropout,
  DropoutAttribute,
} from '../nn-dropout-attributes/dropout-attributes';
import {
  NameAttributeLayerNormalization,
  NormalizedShapeAttributeLayerNormalization,
  ActvFuncAttributeLayerNormalization,
  NameModuleInputAttributeLayerNormalization,
  InputReusedAttributeLayerNormalization,
  LayerNormalizationAttribute,
} from '../nn-layernormalization-attributes/layernormalization-attributes';
import {
  NameAttributeBatchNormalization,
  NumFeaturesAttributeBatchNormalization,
  DimensionAttributeBatchNormalization,
  ActvFuncAttributeBatchNormalization,
  NameModuleInputAttributeBatchNormalization,
  InputReusedAttributeBatchNormalization,
  BatchNormalizationAttribute,
} from '../nn-batchnormalization-attributes/batchnormalization-attributes';
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
} from '../nn-tensorop-attributes/tensorop-attributes';
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
} from '../nn-configuration-attributes/configuration-attributes';
import { NNElementType } from '..';
import { OptionalAttributeRow } from './optional-attribute-row';

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

interface OwnProps {
  element: Conv1DLayer | Conv2DLayer | Conv3DLayer | PoolingLayer | RNNLayer | LSTMLayer | GRULayer | LinearLayer | FlattenLayer | EmbeddingLayer | DropoutLayer | LayerNormalizationLayer | BatchNormalizationLayer | TensorOp | Configuration;
}

type StateProps = {
  elements: ModelState['elements'];
};

interface DispatchProps {
  create: typeof UMLElementRepository.create;
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  getById: (id: string) => UMLElement | null;
  appendToParent: (elementId: string, parentId: string) => void;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      elements: state.elements,
    }),
    {
      create: UMLElementRepository.create,
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
      appendToParent: UMLContainerRepository.append,
    }
  ),
);

type State = {
  fieldToFocus?: Textfield<string> | null;
  colorOpen: boolean;
};

const getInitialState = (): State => ({
  fieldToFocus: undefined,
  colorOpen: false,
});

// Configuration for each layer type
const LAYER_CONFIG: {
  [key: string]: {
    attributeFilter: (element: any) => boolean;
    mandatoryAttributes: Array<{ ctor: any }>;
    optionalAttributes: Array<{ type: string; ctor: any; label: string }>;
  };
} = {
  [NNElementType.Conv1DLayer]: {
    attributeFilter: (type: string) => type.includes('Conv1D'),
    mandatoryAttributes: [
      { ctor: NameAttributeConv1D },
      { ctor: KernelDimAttributeConv1D },
      { ctor: OutChannelsAttributeConv1D },
    ],
    optionalAttributes: [
      { type: NNElementType.StrideDimAttributeConv1D, ctor: StrideDimAttributeConv1D, label: 'stride_dim' },
      { type: NNElementType.InChannelsAttributeConv1D, ctor: InChannelsAttributeConv1D, label: 'in_channels' },
      { type: NNElementType.PaddingAmountAttributeConv1D, ctor: PaddingAmountAttributeConv1D, label: 'padding_amount' },
      { type: NNElementType.PaddingTypeAttributeConv1D, ctor: PaddingTypeAttributeConv1D, label: 'padding_type' },
      { type: NNElementType.ActvFuncAttributeConv1D, ctor: ActvFuncAttributeConv1D, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeConv1D, ctor: NameModuleInputAttributeConv1D, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeConv1D, ctor: InputReusedAttributeConv1D, label: 'input_reused' },
      { type: NNElementType.PermuteInAttributeConv1D, ctor: PermuteInAttributeConv1D, label: 'permute_in' },
      { type: NNElementType.PermuteOutAttributeConv1D, ctor: PermuteOutAttributeConv1D, label: 'permute_out' },
    ],
  },
  [NNElementType.Conv2DLayer]: {
    attributeFilter: (type: string) => type.includes('Conv2D'),
    mandatoryAttributes: [
      { ctor: NameAttributeConv2D },
      { ctor: KernelDimAttributeConv2D },
      { ctor: OutChannelsAttributeConv2D },
    ],
    optionalAttributes: [
      { type: NNElementType.StrideDimAttributeConv2D, ctor: StrideDimAttributeConv2D, label: 'stride_dim' },
      { type: NNElementType.InChannelsAttributeConv2D, ctor: InChannelsAttributeConv2D, label: 'in_channels' },
      { type: NNElementType.PaddingAmountAttributeConv2D, ctor: PaddingAmountAttributeConv2D, label: 'padding_amount' },
      { type: NNElementType.PaddingTypeAttributeConv2D, ctor: PaddingTypeAttributeConv2D, label: 'padding_type' },
      { type: NNElementType.ActvFuncAttributeConv2D, ctor: ActvFuncAttributeConv2D, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeConv2D, ctor: NameModuleInputAttributeConv2D, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeConv2D, ctor: InputReusedAttributeConv2D, label: 'input_reused' },
      { type: NNElementType.PermuteInAttributeConv2D, ctor: PermuteInAttributeConv2D, label: 'permute_in' },
      { type: NNElementType.PermuteOutAttributeConv2D, ctor: PermuteOutAttributeConv2D, label: 'permute_out' },
    ],
  },
  [NNElementType.Conv3DLayer]: {
    attributeFilter: (type: string) => type.includes('Conv3D'),
    mandatoryAttributes: [
      { ctor: NameAttributeConv3D },
      { ctor: KernelDimAttributeConv3D },
      { ctor: OutChannelsAttributeConv3D },
    ],
    optionalAttributes: [
      { type: NNElementType.StrideDimAttributeConv3D, ctor: StrideDimAttributeConv3D, label: 'stride_dim' },
      { type: NNElementType.InChannelsAttributeConv3D, ctor: InChannelsAttributeConv3D, label: 'in_channels' },
      { type: NNElementType.PaddingAmountAttributeConv3D, ctor: PaddingAmountAttributeConv3D, label: 'padding_amount' },
      { type: NNElementType.PaddingTypeAttributeConv3D, ctor: PaddingTypeAttributeConv3D, label: 'padding_type' },
      { type: NNElementType.ActvFuncAttributeConv3D, ctor: ActvFuncAttributeConv3D, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeConv3D, ctor: NameModuleInputAttributeConv3D, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeConv3D, ctor: InputReusedAttributeConv3D, label: 'input_reused' },
      { type: NNElementType.PermuteInAttributeConv3D, ctor: PermuteInAttributeConv3D, label: 'permute_in' },
      { type: NNElementType.PermuteOutAttributeConv3D, ctor: PermuteOutAttributeConv3D, label: 'permute_out' },
    ],
  },
  [NNElementType.PoolingLayer]: {
    attributeFilter: (type: string) => type.includes('Pooling'),
    mandatoryAttributes: [
      { ctor: NameAttributePooling },
      { ctor: PoolingTypeAttributePooling },
      { ctor: DimensionAttributePooling },
    ],
    optionalAttributes: [
      { type: NNElementType.KernelDimAttributePooling, ctor: KernelDimAttributePooling, label: 'kernel_dim' },
      { type: NNElementType.StrideDimAttributePooling, ctor: StrideDimAttributePooling, label: 'stride_dim' },
      { type: NNElementType.PaddingAmountAttributePooling, ctor: PaddingAmountAttributePooling, label: 'padding_amount' },
      { type: NNElementType.PaddingTypeAttributePooling, ctor: PaddingTypeAttributePooling, label: 'padding_type' },
      { type: NNElementType.OutputDimAttributePooling, ctor: OutputDimAttributePooling, label: 'output_dim' },
      { type: NNElementType.ActvFuncAttributePooling, ctor: ActvFuncAttributePooling, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributePooling, ctor: NameModuleInputAttributePooling, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributePooling, ctor: InputReusedAttributePooling, label: 'input_reused' },
      { type: NNElementType.PermuteInAttributePooling, ctor: PermuteInAttributePooling, label: 'permute_in' },
      { type: NNElementType.PermuteOutAttributePooling, ctor: PermuteOutAttributePooling, label: 'permute_out' },
    ],
  },
  [NNElementType.RNNLayer]: {
    attributeFilter: (type: string) => type.includes('RNN'),
    mandatoryAttributes: [
      { ctor: NameAttributeRNN },
      { ctor: HiddenSizeAttributeRNN },
    ],
    optionalAttributes: [
      { type: NNElementType.ReturnTypeAttributeRNN, ctor: ReturnTypeAttributeRNN, label: 'return_type' },
      { type: NNElementType.InputSizeAttributeRNN, ctor: InputSizeAttributeRNN, label: 'input_size' },
      { type: NNElementType.BidirectionalAttributeRNN, ctor: BidirectionalAttributeRNN, label: 'bidirectional' },
      { type: NNElementType.DropoutAttributeRNN, ctor: DropoutAttributeRNN, label: 'dropout' },
      { type: NNElementType.BatchFirstAttributeRNN, ctor: BatchFirstAttributeRNN, label: 'batch_first' },
      { type: NNElementType.ActvFuncAttributeRNN, ctor: ActvFuncAttributeRNN, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeRNN, ctor: NameModuleInputAttributeRNN, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeRNN, ctor: InputReusedAttributeRNN, label: 'input_reused' },
    ],
  },
  [NNElementType.LSTMLayer]: {
    attributeFilter: (type: string) => type.includes('LSTM'),
    mandatoryAttributes: [
      { ctor: NameAttributeLSTM },
      { ctor: HiddenSizeAttributeLSTM },
    ],
    optionalAttributes: [
      { type: NNElementType.ReturnTypeAttributeLSTM, ctor: ReturnTypeAttributeLSTM, label: 'return_type' },
      { type: NNElementType.InputSizeAttributeLSTM, ctor: InputSizeAttributeLSTM, label: 'input_size' },
      { type: NNElementType.BidirectionalAttributeLSTM, ctor: BidirectionalAttributeLSTM, label: 'bidirectional' },
      { type: NNElementType.DropoutAttributeLSTM, ctor: DropoutAttributeLSTM, label: 'dropout' },
      { type: NNElementType.BatchFirstAttributeLSTM, ctor: BatchFirstAttributeLSTM, label: 'batch_first' },
      { type: NNElementType.ActvFuncAttributeLSTM, ctor: ActvFuncAttributeLSTM, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeLSTM, ctor: NameModuleInputAttributeLSTM, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeLSTM, ctor: InputReusedAttributeLSTM, label: 'input_reused' },
    ],
  },
  [NNElementType.GRULayer]: {
    attributeFilter: (type: string) => type.includes('GRU'),
    mandatoryAttributes: [
      { ctor: NameAttributeGRU },
      { ctor: HiddenSizeAttributeGRU },
    ],
    optionalAttributes: [
      { type: NNElementType.ReturnTypeAttributeGRU, ctor: ReturnTypeAttributeGRU, label: 'return_type' },
      { type: NNElementType.InputSizeAttributeGRU, ctor: InputSizeAttributeGRU, label: 'input_size' },
      { type: NNElementType.BidirectionalAttributeGRU, ctor: BidirectionalAttributeGRU, label: 'bidirectional' },
      { type: NNElementType.DropoutAttributeGRU, ctor: DropoutAttributeGRU, label: 'dropout' },
      { type: NNElementType.BatchFirstAttributeGRU, ctor: BatchFirstAttributeGRU, label: 'batch_first' },
      { type: NNElementType.ActvFuncAttributeGRU, ctor: ActvFuncAttributeGRU, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeGRU, ctor: NameModuleInputAttributeGRU, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeGRU, ctor: InputReusedAttributeGRU, label: 'input_reused' },
    ],
  },
  [NNElementType.LinearLayer]: {
    attributeFilter: (type: string) => type.includes('Linear'),
    mandatoryAttributes: [
      { ctor: NameAttributeLinear },
      { ctor: OutFeaturesAttributeLinear },
    ],
    optionalAttributes: [
      { type: NNElementType.InFeaturesAttributeLinear, ctor: InFeaturesAttributeLinear, label: 'in_features' },
      { type: NNElementType.ActvFuncAttributeLinear, ctor: ActvFuncAttributeLinear, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeLinear, ctor: NameModuleInputAttributeLinear, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeLinear, ctor: InputReusedAttributeLinear, label: 'input_reused' },
    ],
  },
  [NNElementType.FlattenLayer]: {
    attributeFilter: (type: string) => type.includes('Flatten'),
    mandatoryAttributes: [
      { ctor: NameAttributeFlatten },
    ],
    optionalAttributes: [
      { type: NNElementType.StartDimAttributeFlatten, ctor: StartDimAttributeFlatten, label: 'start_dim' },
      { type: NNElementType.EndDimAttributeFlatten, ctor: EndDimAttributeFlatten, label: 'end_dim' },
      { type: NNElementType.ActvFuncAttributeFlatten, ctor: ActvFuncAttributeFlatten, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeFlatten, ctor: NameModuleInputAttributeFlatten, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeFlatten, ctor: InputReusedAttributeFlatten, label: 'input_reused' },
    ],
  },
  [NNElementType.EmbeddingLayer]: {
    attributeFilter: (type: string) => type.includes('Embedding'),
    mandatoryAttributes: [
      { ctor: NameAttributeEmbedding },
      { ctor: NumEmbeddingsAttributeEmbedding },
      { ctor: EmbeddingDimAttributeEmbedding },
    ],
    optionalAttributes: [
      { type: NNElementType.ActvFuncAttributeEmbedding, ctor: ActvFuncAttributeEmbedding, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeEmbedding, ctor: NameModuleInputAttributeEmbedding, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeEmbedding, ctor: InputReusedAttributeEmbedding, label: 'input_reused' },
    ],
  },
  [NNElementType.DropoutLayer]: {
    attributeFilter: (type: string) => type.includes('Dropout'),
    mandatoryAttributes: [
      { ctor: NameAttributeDropout },
      { ctor: RateAttributeDropout },
    ],
    optionalAttributes: [
      { type: NNElementType.NameModuleInputAttributeDropout, ctor: NameModuleInputAttributeDropout, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeDropout, ctor: InputReusedAttributeDropout, label: 'input_reused' },
    ],
  },
  [NNElementType.LayerNormalizationLayer]: {
    attributeFilter: (type: string) => type.includes('LayerNormalization'),
    mandatoryAttributes: [
      { ctor: NameAttributeLayerNormalization },
      { ctor: NormalizedShapeAttributeLayerNormalization },
    ],
    optionalAttributes: [
      { type: NNElementType.ActvFuncAttributeLayerNormalization, ctor: ActvFuncAttributeLayerNormalization, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeLayerNormalization, ctor: NameModuleInputAttributeLayerNormalization, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeLayerNormalization, ctor: InputReusedAttributeLayerNormalization, label: 'input_reused' },
    ],
  },
  [NNElementType.BatchNormalizationLayer]: {
    attributeFilter: (type: string) => type.includes('BatchNormalization'),
    mandatoryAttributes: [
      { ctor: NameAttributeBatchNormalization },
      { ctor: NumFeaturesAttributeBatchNormalization },
      { ctor: DimensionAttributeBatchNormalization },
    ],
    optionalAttributes: [
      { type: NNElementType.ActvFuncAttributeBatchNormalization, ctor: ActvFuncAttributeBatchNormalization, label: 'actv_func' },
      { type: NNElementType.NameModuleInputAttributeBatchNormalization, ctor: NameModuleInputAttributeBatchNormalization, label: 'name_module_input' },
      { type: NNElementType.InputReusedAttributeBatchNormalization, ctor: InputReusedAttributeBatchNormalization, label: 'input_reused' },
    ],
  },
  [NNElementType.TensorOp]: {
    attributeFilter: (type: string) => type.includes('TensorOp'),
    mandatoryAttributes: [
      { ctor: NameAttributeTensorOp },
      { ctor: TnsTypeAttributeTensorOp },
    ],
    optionalAttributes: [
      { type: NNElementType.ConcatenateDimAttributeTensorOp, ctor: ConcatenateDimAttributeTensorOp, label: 'concatenate_dim' },
      { type: NNElementType.LayersOfTensorsAttributeTensorOp, ctor: LayersOfTensorsAttributeTensorOp, label: 'layers_of_tensors' },
      { type: NNElementType.ReshapeDimAttributeTensorOp, ctor: ReshapeDimAttributeTensorOp, label: 'reshape_dim' },
      { type: NNElementType.TransposeDimAttributeTensorOp, ctor: TransposeDimAttributeTensorOp, label: 'transpose_dim' },
      { type: NNElementType.PermuteDimAttributeTensorOp, ctor: PermuteDimAttributeTensorOp, label: 'permute_dim' },
      { type: NNElementType.InputReusedAttributeTensorOp, ctor: InputReusedAttributeTensorOp, label: 'input_reused' },
    ],
  },
  [NNElementType.Configuration]: {
    attributeFilter: (type: string) => type.includes('Configuration'),
    mandatoryAttributes: [
      { ctor: BatchSizeAttributeConfiguration },
      { ctor: EpochsAttributeConfiguration },
      { ctor: LearningRateAttributeConfiguration },
      { ctor: OptimizerAttributeConfiguration },
      { ctor: LossFunctionAttributeConfiguration },
      { ctor: MetricsAttributeConfiguration },
    ],
    optionalAttributes: [
      { type: NNElementType.WeightDecayAttributeConfiguration, ctor: WeightDecayAttributeConfiguration, label: 'weight_decay' },
      { type: NNElementType.MomentumAttributeConfiguration, ctor: MomentumAttributeConfiguration, label: 'momentum' },
    ],
  },
};

class NNComponentUpdateComponent extends Component<Props, State> {
  state = getInitialState();
  newAttributeField = createRef<Textfield<string>>();

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  private delete = (id: string) => () => {
    this.props.delete(id);
  };

  private createMandatoryAttributes = () => {
    const { element, elements } = this.props;
    const config = LAYER_CONFIG[element.type];

    if (!config) return;

    // Collect existing name values to avoid duplicates (fallback for legacy/loaded diagrams)
    const existingNames = new Set<string>(
      Object.values(elements)
        .filter((el: any) => (el as INNAttribute).attributeName === 'name')
        .map((el: any) => (el as INNAttribute).value as string)
    );

    config.mandatoryAttributes.forEach(({ ctor }) => {
      const attr = new ctor({ owner: element.id });

      if ((attr as INNAttribute).attributeName === 'name') {
        const baseName = (attr as INNAttribute).value;
        let uniqueName = baseName;
        let counter = 2;
        while (existingNames.has(uniqueName)) {
          uniqueName = `${baseName}${counter}`;
          counter++;
        }
        (attr as INNAttribute).value = uniqueName;
        attr.name = `name = ${uniqueName}`;
        existingNames.add(uniqueName);
      }

      this.props.create(attr, element.id);
      this.props.appendToParent(attr.id, element.id);
    });
  };

  componentDidMount() {
    const { element, elements } = this.props;
    const config = LAYER_CONFIG[element.type];

    if (!config) return;

    // Check if mandatory attributes already exist (element was loaded from saved state)
    const hasMandatoryAttributes = Object.values(elements).some(
      (el) => el.owner === element.id &&
        (el as INNAttribute).isMandatory === true &&
        config.attributeFilter(el.type)
    );

    // Only create mandatory attributes for new elements (none exist yet)
    if (!hasMandatoryAttributes) {
      this.createMandatoryAttributes();
    }
  }

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>) {
    if (this.state.fieldToFocus) {
      this.state.fieldToFocus.focus();
      this.setState({ fieldToFocus: undefined });
    }
  }


  // Helper to filter TensorOp optional attributes based on tns_type value
  private getTensorOpOptionalAttributes = (
    tnsType: string,
    optionalAttributes: Array<{ type: string; ctor: any; label: string }>
  ) => {
    switch (tnsType) {
      case 'reshape':
        return optionalAttributes.filter((attr) => attr.label === 'reshape_dim');
      case 'concatenate':
        return optionalAttributes.filter((attr) =>
          ['layers_of_tensors', 'concatenate_dim'].includes(attr.label)
        );
      case 'transpose':
        return optionalAttributes.filter((attr) => attr.label === 'transpose_dim');
      case 'permute':
        return optionalAttributes.filter((attr) => attr.label === 'permute_dim');
      default:
        return optionalAttributes.filter((attr) => attr.label === 'layers_of_tensors');
    }
  };

  // Helper to filter Pooling optional attributes based on pooling_type value
  private getPoolingOptionalAttributes = (
    poolingType: string,
    optionalAttributes: Array<{ type: string; ctor: any; label: string }>
  ) => {
    // Attributes to hide for global pooling types
    const globalHiddenAttrs = ['kernel_dim', 'stride_dim', 'padding_amount', 'padding_type', 'output_dim'];
    // Attributes to hide for adaptive pooling types (keep output_dim)
    const adaptiveHiddenAttrs = ['kernel_dim', 'stride_dim', 'padding_amount', 'padding_type'];
    // Attributes to hide for standard max/average pooling
    const standardHiddenAttrs = ['output_dim'];

    if (poolingType === 'global_average' || poolingType === 'global_max') {
      return optionalAttributes.filter((attr) => !globalHiddenAttrs.includes(attr.label));
    } else if (poolingType === 'adaptive_average' || poolingType === 'adaptive_max') {
      return optionalAttributes.filter((attr) => !adaptiveHiddenAttrs.includes(attr.label));
    } else if (poolingType === 'average' || poolingType === 'max') {
      return optionalAttributes.filter((attr) => !standardHiddenAttrs.includes(attr.label));
    }
    // For other pooling types, show all attributes
    return optionalAttributes;
  };

  render() {
    const { element, elements } = this.props;
    const config = LAYER_CONFIG[element.type];

    if (!config) return null;

    // Get the current element from state to ensure we have the latest ownedElements
    const currentElement = (elements[element.id] as Conv1DLayer | Conv2DLayer | Conv3DLayer | PoolingLayer | RNNLayer | LSTMLayer | GRULayer | LinearLayer | FlattenLayer | EmbeddingLayer | DropoutLayer | LayerNormalizationLayer | BatchNormalizationLayer | TensorOp | Configuration) || element;

    // Find all attributes by owner using the config filter
    const allElementsArray = Object.values(elements);
    const children = allElementsArray.filter(
      (el): el is Conv1DAttribute | Conv2DAttribute | Conv3DAttribute | PoolingAttribute | RNNAttribute | LSTMAttribute | GRUAttribute | LinearAttribute | FlattenAttribute | EmbeddingAttribute | DropoutAttribute | LayerNormalizationAttribute | BatchNormalizationAttribute | TensorOpAttribute | ConfigurationAttribute =>
        el.owner === element.id &&
        (el as INNAttribute).attributeName !== undefined &&
        config.attributeFilter(el.type)
    ) as (Conv1DAttribute | Conv2DAttribute | Conv3DAttribute | PoolingAttribute | RNNAttribute | LSTMAttribute | GRUAttribute | LinearAttribute | FlattenAttribute | EmbeddingAttribute | DropoutAttribute | LayerNormalizationAttribute | BatchNormalizationAttribute | TensorOpAttribute | ConfigurationAttribute)[];

    // Separate mandatory and optional attributes
    const mandatoryAttributes = children.filter((attr) => attr.isMandatory);

    // Get optional attributes - filter based on element type and attribute values
    let optionalAttributes = config.optionalAttributes;
    if (element.type === NNElementType.TensorOp) {
      const tnsTypeAttr = children.find(
        (attr) => (attr as TensorOpAttribute).attributeName === 'tns_type'
      ) as TensorOpAttribute | undefined;
      const tnsType = tnsTypeAttr?.value || 'reshape';
      optionalAttributes = this.getTensorOpOptionalAttributes(tnsType, config.optionalAttributes);
    } else if (element.type === NNElementType.PoolingLayer) {
      const poolingTypeAttr = children.find(
        (attr) => (attr as PoolingAttribute).attributeName === 'pooling_type'
      ) as PoolingAttribute | undefined;
      const poolingType = poolingTypeAttr?.value || 'max';
      optionalAttributes = this.getPoolingOptionalAttributes(poolingType, config.optionalAttributes);
    }

    return (
      <div>
        <section>
          <Flex>
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <StylePane
            open={this.state.colorOpen}
            element={currentElement}
            onColorChange={this.props.update}
            fillColor
            lineColor
            textColor
          />
          <Divider />
        </section>
        <section>
          <Header>{this.props.translate('popup.attributes')}</Header>
          {/* Render mandatory attributes */}
          {mandatoryAttributes.map((attribute) => {
            return (
              <NNAttributeUpdate
                key={attribute.id}
                element={attribute as Conv1DAttribute | Conv2DAttribute | Conv3DAttribute | PoolingAttribute | RNNAttribute | LSTMAttribute | GRUAttribute | LinearAttribute | FlattenAttribute | EmbeddingAttribute | DropoutAttribute | LayerNormalizationAttribute | BatchNormalizationAttribute | TensorOpAttribute | ConfigurationAttribute}
              />
            );
          })}
          {/* Render optional attributes with checkboxes */}
          {optionalAttributes.map((attrDef) => (
            <OptionalAttributeRow
              key={attrDef.type}
              attributeType={attrDef.type}
              attributeCtor={attrDef.ctor}
              label={attrDef.label}
              layerId={element.id}
            />
          ))}
        </section>
      </div>
    );
  }
}

export const NNComponentUpdate = enhance(NNComponentUpdateComponent);
