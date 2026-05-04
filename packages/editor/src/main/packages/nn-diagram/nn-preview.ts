import { ComposePreview, PreviewElement } from '../compose-preview';
import { UMLElement } from '../../services/uml-element/uml-element';
import { NNSectionTitle, NNSectionSeparator } from './nn-section-elements';
import { Conv1DLayer } from './nn-conv1d-layer/nn-conv1d-layer';
import { Conv2DLayer } from './nn-conv2d-layer/nn-conv2d-layer';
import { Conv3DLayer } from './nn-conv3d-layer/nn-conv3d-layer';
import { PoolingLayer } from './nn-pooling-layer/nn-pooling-layer';
import { RNNLayer } from './nn-rnn-layer/nn-rnn-layer';
import { LSTMLayer } from './nn-lstm-layer/nn-lstm-layer';
import { GRULayer } from './nn-gru-layer/nn-gru-layer';
import { LinearLayer } from './nn-linear-layer/nn-linear-layer';
import { FlattenLayer } from './nn-flatten-layer/nn-flatten-layer';
import { EmbeddingLayer } from './nn-embedding-layer/nn-embedding-layer';
import { DropoutLayer } from './nn-dropout-layer/nn-dropout-layer';
import { LayerNormalizationLayer } from './nn-layernormalization-layer/nn-layernormalization-layer';
import { BatchNormalizationLayer } from './nn-batchnormalization-layer/nn-batchnormalization-layer';
import { TensorOp } from './nn-tensorop/nn-tensorop';
import { Configuration } from './nn-configuration/nn-configuration';
import { NNContainer } from './nn-container/nn-container';
import { NNReference } from './nn-reference/nn-reference';
import {
  NameAttributeConv1D,
  KernelDimAttributeConv1D,
  OutChannelsAttributeConv1D,
} from './nn-conv1d-attributes/conv1d-attributes';
import {
  NameAttributeConv2D,
  KernelDimAttributeConv2D,
  OutChannelsAttributeConv2D,
} from './nn-conv2d-attributes/conv2d-attributes';
import {
  NameAttributeConv3D,
  KernelDimAttributeConv3D,
  OutChannelsAttributeConv3D,
} from './nn-conv3d-attributes/conv3d-attributes';
import {
  NameAttributePooling,
  PoolingTypeAttributePooling,
  DimensionAttributePooling,
} from './nn-pooling-attributes/pooling-attributes';
import {
  NameAttributeRNN,
  HiddenSizeAttributeRNN,
} from './nn-rnn-attributes/rnn-attributes';
import {
  NameAttributeLSTM,
  HiddenSizeAttributeLSTM,
} from './nn-lstm-attributes/lstm-attributes';
import {
  NameAttributeGRU,
  HiddenSizeAttributeGRU,
} from './nn-gru-attributes/gru-attributes';
import {
  NameAttributeLinear,
  OutFeaturesAttributeLinear,
} from './nn-linear-attributes/linear-attributes';
import {
  NameAttributeFlatten,
} from './nn-flatten-attributes/flatten-attributes';
import {
  NameAttributeEmbedding,
  NumEmbeddingsAttributeEmbedding,
  EmbeddingDimAttributeEmbedding,
} from './nn-embedding-attributes/embedding-attributes';
import {
  NameAttributeDropout,
  RateAttributeDropout,
} from './nn-dropout-attributes/dropout-attributes';
import {
  NameAttributeLayerNormalization,
  NormalizedShapeAttributeLayerNormalization,
} from './nn-layernormalization-attributes/layernormalization-attributes';
import {
  NameAttributeBatchNormalization,
  NumFeaturesAttributeBatchNormalization,
  DimensionAttributeBatchNormalization,
} from './nn-batchnormalization-attributes/batchnormalization-attributes';
import {
  NameAttributeTensorOp,
  TnsTypeAttributeTensorOp,
} from './nn-tensorop-attributes/tensorop-attributes';
import {
  BatchSizeAttributeConfiguration,
  EpochsAttributeConfiguration,
  LearningRateAttributeConfiguration,
  OptimizerAttributeConfiguration,
  LossFunctionAttributeConfiguration,
  MetricsAttributeConfiguration,
} from './nn-configuration-attributes/configuration-attributes';
import { TrainingDataset, TestDataset } from './nn-dataset/nn-dataset';
import {
  NameAttributeDataset,
  PathDataAttributeDataset,
} from './nn-dataset-attributes/dataset-attributes';
import { ILayer } from '../../services/layouter/layer';

export const composeNNPreview: ComposePreview = (layer: ILayer, translate: (id: string) => string): UMLElement[] => {
  const elements: UMLElement[] = [];
  const layerElements: UMLElement[] = [];
  const tensorOpElements: UMLElement[] = [];
  const configurationElements: UMLElement[] = [];
  const datasetElements: UMLElement[] = [];

  // Conv1DLayer setup
  const conv1DLayer = new Conv1DLayer({ name: translate('packages.NNDiagram.Conv1DLayer') });

  const nameAttrConv1D = new NameAttributeConv1D({ owner: conv1DLayer.id });
  const kernelDimAttrConv1D = new KernelDimAttributeConv1D({ owner: conv1DLayer.id });
  const outChannelsAttrConv1D = new OutChannelsAttributeConv1D({ owner: conv1DLayer.id });

  conv1DLayer.ownedElements = [
    nameAttrConv1D.id,
    kernelDimAttrConv1D.id,
    outChannelsAttrConv1D.id,
  ];
  layerElements.push(...(conv1DLayer.render(layer, [nameAttrConv1D, kernelDimAttrConv1D, outChannelsAttrConv1D]) as UMLElement[]));

  // Conv2DLayer setup
  const conv2DLayer = new Conv2DLayer({ name: translate('packages.NNDiagram.Conv2DLayer') });

  const nameAttrConv2D = new NameAttributeConv2D({ owner: conv2DLayer.id });
  const kernelDimAttrConv2D = new KernelDimAttributeConv2D({ owner: conv2DLayer.id });
  const outChannelsAttrConv2D = new OutChannelsAttributeConv2D({ owner: conv2DLayer.id });

  conv2DLayer.ownedElements = [
    nameAttrConv2D.id,
    kernelDimAttrConv2D.id,
    outChannelsAttrConv2D.id,
  ];
  layerElements.push(...(conv2DLayer.render(layer, [nameAttrConv2D, kernelDimAttrConv2D, outChannelsAttrConv2D]) as UMLElement[]));

  // Conv3DLayer setup
  const conv3DLayer = new Conv3DLayer({ name: translate('packages.NNDiagram.Conv3DLayer') });

  const nameAttrConv3D = new NameAttributeConv3D({ owner: conv3DLayer.id });
  const kernelDimAttrConv3D = new KernelDimAttributeConv3D({ owner: conv3DLayer.id });
  const outChannelsAttrConv3D = new OutChannelsAttributeConv3D({ owner: conv3DLayer.id });

  conv3DLayer.ownedElements = [
    nameAttrConv3D.id,
    kernelDimAttrConv3D.id,
    outChannelsAttrConv3D.id,
  ];
  layerElements.push(...(conv3DLayer.render(layer, [nameAttrConv3D, kernelDimAttrConv3D, outChannelsAttrConv3D]) as UMLElement[]));

  // PoolingLayer setup
  const poolingLayer = new PoolingLayer({ name: translate('packages.NNDiagram.PoolingLayer') });

  const nameAttrPooling = new NameAttributePooling({ owner: poolingLayer.id });
  const poolingTypeAttrPooling = new PoolingTypeAttributePooling({ owner: poolingLayer.id });
  const dimAttrPooling = new DimensionAttributePooling({ owner: poolingLayer.id });

  poolingLayer.ownedElements = [
    nameAttrPooling.id,
    poolingTypeAttrPooling.id,
    dimAttrPooling.id,
  ];
  layerElements.push(...(poolingLayer.render(layer, [nameAttrPooling, poolingTypeAttrPooling, dimAttrPooling]) as UMLElement[]));

  // RNNLayer setup
  const rnnLayer = new RNNLayer({ name: translate('packages.NNDiagram.RNNLayer') });

  const nameAttrRNN = new NameAttributeRNN({ owner: rnnLayer.id });
  const hiddenSizeAttrRNN = new HiddenSizeAttributeRNN({ owner: rnnLayer.id });

  rnnLayer.ownedElements = [
    nameAttrRNN.id,
    hiddenSizeAttrRNN.id,
  ];
  layerElements.push(...(rnnLayer.render(layer, [nameAttrRNN, hiddenSizeAttrRNN]) as UMLElement[]));

  // LSTMLayer setup
  const lstmLayer = new LSTMLayer({ name: translate('packages.NNDiagram.LSTMLayer') });

  const nameAttrLSTM = new NameAttributeLSTM({ owner: lstmLayer.id });
  const hiddenSizeAttrLSTM = new HiddenSizeAttributeLSTM({ owner: lstmLayer.id });

  lstmLayer.ownedElements = [
    nameAttrLSTM.id,
    hiddenSizeAttrLSTM.id,
  ];
  layerElements.push(...(lstmLayer.render(layer, [nameAttrLSTM, hiddenSizeAttrLSTM]) as UMLElement[]));

  // GRULayer setup
  const gruLayer = new GRULayer({ name: translate('packages.NNDiagram.GRULayer') });

  const nameAttrGRU = new NameAttributeGRU({ owner: gruLayer.id });
  const hiddenSizeAttrGRU = new HiddenSizeAttributeGRU({ owner: gruLayer.id });

  gruLayer.ownedElements = [
    nameAttrGRU.id,
    hiddenSizeAttrGRU.id,
  ];
  layerElements.push(...(gruLayer.render(layer, [nameAttrGRU, hiddenSizeAttrGRU]) as UMLElement[]));

  // LinearLayer setup
  const linearLayer = new LinearLayer({ name: translate('packages.NNDiagram.LinearLayer') });

  const nameAttrLinear = new NameAttributeLinear({ owner: linearLayer.id });
  const outFeaturesAttrLinear = new OutFeaturesAttributeLinear({ owner: linearLayer.id });

  linearLayer.ownedElements = [
    nameAttrLinear.id,
    outFeaturesAttrLinear.id,
  ];
  layerElements.push(...(linearLayer.render(layer, [nameAttrLinear, outFeaturesAttrLinear]) as UMLElement[]));

  // FlattenLayer setup
  const flattenLayer = new FlattenLayer({ name: translate('packages.NNDiagram.FlattenLayer') });

  const nameAttrFlatten = new NameAttributeFlatten({ owner: flattenLayer.id });

  flattenLayer.ownedElements = [
    nameAttrFlatten.id,
  ];
  layerElements.push(...(flattenLayer.render(layer, [nameAttrFlatten]) as UMLElement[]));

  // EmbeddingLayer setup
  const embeddingLayer = new EmbeddingLayer({ name: translate('packages.NNDiagram.EmbeddingLayer') });

  const nameAttrEmbedding = new NameAttributeEmbedding({ owner: embeddingLayer.id });
  const numEmbeddingsAttrEmbedding = new NumEmbeddingsAttributeEmbedding({ owner: embeddingLayer.id });
  const embeddingDimAttrEmbedding = new EmbeddingDimAttributeEmbedding({ owner: embeddingLayer.id });

  embeddingLayer.ownedElements = [
    nameAttrEmbedding.id,
    numEmbeddingsAttrEmbedding.id,
    embeddingDimAttrEmbedding.id,
  ];
  layerElements.push(...(embeddingLayer.render(layer, [nameAttrEmbedding, numEmbeddingsAttrEmbedding, embeddingDimAttrEmbedding]) as UMLElement[]));

  // DropoutLayer setup
  const dropoutLayer = new DropoutLayer({ name: translate('packages.NNDiagram.DropoutLayer') });

  const nameAttrDropout = new NameAttributeDropout({ owner: dropoutLayer.id });
  const rateAttrDropout = new RateAttributeDropout({ owner: dropoutLayer.id });

  dropoutLayer.ownedElements = [
    nameAttrDropout.id,
    rateAttrDropout.id,
  ];
  layerElements.push(...(dropoutLayer.render(layer, [nameAttrDropout, rateAttrDropout]) as UMLElement[]));

  // LayerNormalizationLayer setup
  const layerNormLayer = new LayerNormalizationLayer({ name: translate('packages.NNDiagram.LayerNormalizationLayer') });

  const nameAttrLayerNorm = new NameAttributeLayerNormalization({ owner: layerNormLayer.id });
  const normalizedShapeAttrLayerNorm = new NormalizedShapeAttributeLayerNormalization({ owner: layerNormLayer.id });

  layerNormLayer.ownedElements = [
    nameAttrLayerNorm.id,
    normalizedShapeAttrLayerNorm.id,
  ];
  layerElements.push(...(layerNormLayer.render(layer, [nameAttrLayerNorm, normalizedShapeAttrLayerNorm]) as UMLElement[]));

  // BatchNormalizationLayer setup
  const batchNormLayer = new BatchNormalizationLayer({ name: translate('packages.NNDiagram.BatchNormalizationLayer') });

  const nameAttrBatchNorm = new NameAttributeBatchNormalization({ owner: batchNormLayer.id });
  const numFeaturesAttrBatchNorm = new NumFeaturesAttributeBatchNormalization({ owner: batchNormLayer.id });
  const dimensionAttrBatchNorm = new DimensionAttributeBatchNormalization({ owner: batchNormLayer.id });

  batchNormLayer.ownedElements = [
    nameAttrBatchNorm.id,
    numFeaturesAttrBatchNorm.id,
    dimensionAttrBatchNorm.id,
  ];
  layerElements.push(...(batchNormLayer.render(layer, [nameAttrBatchNorm, numFeaturesAttrBatchNorm, dimensionAttrBatchNorm]) as UMLElement[]));

  // TensorOp setup
  const tensorOp = new TensorOp({ name: translate('packages.NNDiagram.TensorOp') });

  const nameAttrTensorOp = new NameAttributeTensorOp({ owner: tensorOp.id });
  const tnsTypeAttrTensorOp = new TnsTypeAttributeTensorOp({ owner: tensorOp.id });

  tensorOp.ownedElements = [
    nameAttrTensorOp.id,
    tnsTypeAttrTensorOp.id,
  ];
  tensorOpElements.push(...(tensorOp.render(layer, [nameAttrTensorOp, tnsTypeAttrTensorOp]) as UMLElement[]));

  // Configuration setup
  const configuration = new Configuration({ name: translate('packages.NNDiagram.Configuration') });

  const batchSizeAttr = new BatchSizeAttributeConfiguration({ owner: configuration.id });
  const epochsAttr = new EpochsAttributeConfiguration({ owner: configuration.id });
  const learningRateAttr = new LearningRateAttributeConfiguration({ owner: configuration.id });
  const optimizerAttr = new OptimizerAttributeConfiguration({ owner: configuration.id });
  const lossFunctionAttr = new LossFunctionAttributeConfiguration({ owner: configuration.id });
  const metricsAttr = new MetricsAttributeConfiguration({ owner: configuration.id });

  configuration.ownedElements = [
    batchSizeAttr.id,
    epochsAttr.id,
    learningRateAttr.id,
    optimizerAttr.id,
    lossFunctionAttr.id,
    metricsAttr.id,
  ];
  configurationElements.push(...(configuration.render(layer, [batchSizeAttr, epochsAttr, learningRateAttr, optimizerAttr, lossFunctionAttr, metricsAttr]) as UMLElement[]));

  // TrainingDataset setup
  const trainingDataset = new TrainingDataset({ name: translate('packages.NNDiagram.TrainingDataset') });
  const nameAttrTrainingDataset = new NameAttributeDataset({ owner: trainingDataset.id, value: 'train_data' });
  const pathAttrTrainingDataset = new PathDataAttributeDataset({ owner: trainingDataset.id });

  trainingDataset.ownedElements = [
    nameAttrTrainingDataset.id,
    pathAttrTrainingDataset.id,
  ];
  datasetElements.push(...(trainingDataset.render(layer, [nameAttrTrainingDataset, pathAttrTrainingDataset]) as UMLElement[]));

  // TestDataset setup
  const testDataset = new TestDataset({ name: translate('packages.NNDiagram.TestDataset') });
  const nameAttrTestDataset = new NameAttributeDataset({ owner: testDataset.id, value: 'test_data' });
  const pathAttrTestDataset = new PathDataAttributeDataset({ owner: testDataset.id });

  testDataset.ownedElements = [
    nameAttrTestDataset.id,
    pathAttrTestDataset.id,
  ];
  datasetElements.push(...(testDataset.render(layer, [nameAttrTestDataset, pathAttrTestDataset]) as UMLElement[]));

  // NNContainer setup - compact in sidebar, clone() sets tall bounds when dropped
  const nnContainer = new NNContainer({ name: translate('packages.NNDiagram.NNContainer') });
  nnContainer.bounds = { ...nnContainer.bounds, width: 280, height: 150 };

  // NNReference setup
  const nnReference = new NNReference({ name: translate('packages.NNDiagram.NNReference') });
  nnReference.bounds = { ...nnReference.bounds, width: 120, height: 40 };

  // Combine all elements with section titles and separators
  const structureTitle = new NNSectionTitle({ name: 'NN Structure' });
  (structureTitle as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };

  const layersTitle = new NNSectionTitle({ name: 'NN Layers' });
  (layersTitle as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };

  const tensorOpsTitle = new NNSectionTitle({ name: 'NN TensorOps' });
  (tensorOpsTitle as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };

  const configurationTitle = new NNSectionTitle({ name: 'NN Configuration' });
  (configurationTitle as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };

  const datasetsTitle = new NNSectionTitle({ name: translate('packages.NNDiagram.Datasets') });
  (datasetsTitle as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };

  const separator0 = new NNSectionSeparator();
  (separator0 as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };

  const separator1 = new NNSectionSeparator();
  (separator1 as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };

  const separator2 = new NNSectionSeparator();
  (separator2 as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };

  const separator3 = new NNSectionSeparator();
  (separator3 as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default' };

  // Structure section (NNContainer, NNReference)
  elements.push(structureTitle);
  elements.push(nnContainer);
  elements.push(nnReference);
  elements.push(separator0);

  // Layers section
  elements.push(layersTitle);
  elements.push(...layerElements);
  elements.push(separator1);
  elements.push(tensorOpsTitle);
  elements.push(...tensorOpElements);
  elements.push(separator2);
  elements.push(configurationTitle);
  elements.push(...configurationElements);
  elements.push(separator3);
  elements.push(datasetsTitle);
  elements.push(...datasetElements);

  // Add spacer after Configuration to prevent collision with Comment separator
  const spacer = new NNSectionSeparator({ bounds: { x: 0, y: 0, width: 100, height: 20 } });
  (spacer as PreviewElement).styles = { pointerEvents: 'none', cursor: 'default', opacity: 0 };
  elements.push(spacer);

  return elements;
};
