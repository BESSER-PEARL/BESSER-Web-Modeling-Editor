export const NNElementType = {
  Package: 'Package',
  Class: 'Class',
  AbstractClass: 'AbstractClass',
  Interface: 'Interface',
  Enumeration: 'Enumeration',
  ClassAttribute: 'ClassAttribute',
  ClassMethod: 'ClassMethod',
  ClassOCLConstraint: 'ClassOCLConstraint',

  Conv1DLayer: 'Conv1DLayer',
  // Conv1D Layer Attributes - Mandatory
  NameAttributeConv1D: 'NameAttributeConv1D',
  KernelDimAttributeConv1D: 'KernelDimAttributeConv1D',
  OutChannelsAttributeConv1D: 'OutChannelsAttributeConv1D',
  // Conv1D Layer Attributes - Optional
  StrideDimAttributeConv1D: 'StrideDimAttributeConv1D',
  InChannelsAttributeConv1D: 'InChannelsAttributeConv1D',
  PaddingAmountAttributeConv1D: 'PaddingAmountAttributeConv1D',
  PaddingTypeAttributeConv1D: 'PaddingTypeAttributeConv1D',
  ActvFuncAttributeConv1D: 'ActvFuncAttributeConv1D',
  NameModuleInputAttributeConv1D: 'NameModuleInputAttributeConv1D',
  InputReusedAttributeConv1D: 'InputReusedAttributeConv1D',
  PermuteInAttributeConv1D: 'PermuteInAttributeConv1D',
  PermuteOutAttributeConv1D: 'PermuteOutAttributeConv1D',

  Conv2DLayer: 'Conv2DLayer',
  // Conv2D Layer Attributes - Mandatory
  NameAttributeConv2D: 'NameAttributeConv2D',
  KernelDimAttributeConv2D: 'KernelDimAttributeConv2D',
  OutChannelsAttributeConv2D: 'OutChannelsAttributeConv2D',
  // Conv2D Layer Attributes - Optional
  StrideDimAttributeConv2D: 'StrideDimAttributeConv2D',
  InChannelsAttributeConv2D: 'InChannelsAttributeConv2D',
  PaddingAmountAttributeConv2D: 'PaddingAmountAttributeConv2D',
  PaddingTypeAttributeConv2D: 'PaddingTypeAttributeConv2D',
  ActvFuncAttributeConv2D: 'ActvFuncAttributeConv2D',
  NameModuleInputAttributeConv2D: 'NameModuleInputAttributeConv2D',
  InputReusedAttributeConv2D: 'InputReusedAttributeConv2D',
  PermuteInAttributeConv2D: 'PermuteInAttributeConv2D',
  PermuteOutAttributeConv2D: 'PermuteOutAttributeConv2D',

  Conv3DLayer: 'Conv3DLayer',
  // Conv3D Layer Attributes - Mandatory
  NameAttributeConv3D: 'NameAttributeConv3D',
  KernelDimAttributeConv3D: 'KernelDimAttributeConv3D',
  OutChannelsAttributeConv3D: 'OutChannelsAttributeConv3D',
  // Conv3D Layer Attributes - Optional
  StrideDimAttributeConv3D: 'StrideDimAttributeConv3D',
  InChannelsAttributeConv3D: 'InChannelsAttributeConv3D',
  PaddingAmountAttributeConv3D: 'PaddingAmountAttributeConv3D',
  PaddingTypeAttributeConv3D: 'PaddingTypeAttributeConv3D',
  ActvFuncAttributeConv3D: 'ActvFuncAttributeConv3D',
  NameModuleInputAttributeConv3D: 'NameModuleInputAttributeConv3D',
  InputReusedAttributeConv3D: 'InputReusedAttributeConv3D',
  PermuteInAttributeConv3D: 'PermuteInAttributeConv3D',
  PermuteOutAttributeConv3D: 'PermuteOutAttributeConv3D',

  PoolingLayer: 'PoolingLayer',
  // Pooling Layer Attributes - Mandatory
  NameAttributePooling: 'NameAttributePooling',
  PoolingTypeAttributePooling: 'PoolingTypeAttributePooling',
  DimensionAttributePooling: 'DimensionAttributePooling',
  // Pooling Layer Attributes - Optional
  KernelDimAttributePooling: 'KernelDimAttributePooling',
  StrideDimAttributePooling: 'StrideDimAttributePooling',
  PaddingAmountAttributePooling: 'PaddingAmountAttributePooling',
  PaddingTypeAttributePooling: 'PaddingTypeAttributePooling',
  OutputDimAttributePooling: 'OutputDimAttributePooling',
  ActvFuncAttributePooling: 'ActvFuncAttributePooling',
  NameModuleInputAttributePooling: 'NameModuleInputAttributePooling',
  InputReusedAttributePooling: 'InputReusedAttributePooling',
  PermuteInAttributePooling: 'PermuteInAttributePooling',
  PermuteOutAttributePooling: 'PermuteOutAttributePooling',

  RNNLayer: 'RNNLayer',
  // RNN Layer Attributes - Mandatory
  NameAttributeRNN: 'NameAttributeRNN',
  HiddenSizeAttributeRNN: 'HiddenSizeAttributeRNN',
  // RNN Layer Attributes - Optional
  ReturnTypeAttributeRNN: 'ReturnTypeAttributeRNN',
  InputSizeAttributeRNN: 'InputSizeAttributeRNN',
  BidirectionalAttributeRNN: 'BidirectionalAttributeRNN',
  DropoutAttributeRNN: 'DropoutAttributeRNN',
  BatchFirstAttributeRNN: 'BatchFirstAttributeRNN',
  ActvFuncAttributeRNN: 'ActvFuncAttributeRNN',
  NameModuleInputAttributeRNN: 'NameModuleInputAttributeRNN',
  InputReusedAttributeRNN: 'InputReusedAttributeRNN',

  LSTMLayer: 'LSTMLayer',
  // LSTM Layer Attributes - Mandatory
  NameAttributeLSTM: 'NameAttributeLSTM',
  HiddenSizeAttributeLSTM: 'HiddenSizeAttributeLSTM',
  // LSTM Layer Attributes - Optional
  ReturnTypeAttributeLSTM: 'ReturnTypeAttributeLSTM',
  InputSizeAttributeLSTM: 'InputSizeAttributeLSTM',
  BidirectionalAttributeLSTM: 'BidirectionalAttributeLSTM',
  DropoutAttributeLSTM: 'DropoutAttributeLSTM',
  BatchFirstAttributeLSTM: 'BatchFirstAttributeLSTM',
  ActvFuncAttributeLSTM: 'ActvFuncAttributeLSTM',
  NameModuleInputAttributeLSTM: 'NameModuleInputAttributeLSTM',
  InputReusedAttributeLSTM: 'InputReusedAttributeLSTM',

  GRULayer: 'GRULayer',
  // GRU Layer Attributes - Mandatory
  NameAttributeGRU: 'NameAttributeGRU',
  HiddenSizeAttributeGRU: 'HiddenSizeAttributeGRU',
  // GRU Layer Attributes - Optional
  ReturnTypeAttributeGRU: 'ReturnTypeAttributeGRU',
  InputSizeAttributeGRU: 'InputSizeAttributeGRU',
  BidirectionalAttributeGRU: 'BidirectionalAttributeGRU',
  DropoutAttributeGRU: 'DropoutAttributeGRU',
  BatchFirstAttributeGRU: 'BatchFirstAttributeGRU',
  ActvFuncAttributeGRU: 'ActvFuncAttributeGRU',
  NameModuleInputAttributeGRU: 'NameModuleInputAttributeGRU',
  InputReusedAttributeGRU: 'InputReusedAttributeGRU',

  LinearLayer: 'LinearLayer',
  // Linear Layer Attributes - Mandatory
  NameAttributeLinear: 'NameAttributeLinear',
  OutFeaturesAttributeLinear: 'OutFeaturesAttributeLinear',
  // Linear Layer Attributes - Optional
  InFeaturesAttributeLinear: 'InFeaturesAttributeLinear',
  ActvFuncAttributeLinear: 'ActvFuncAttributeLinear',
  NameModuleInputAttributeLinear: 'NameModuleInputAttributeLinear',
  InputReusedAttributeLinear: 'InputReusedAttributeLinear',

  FlattenLayer: 'FlattenLayer',
  // Flatten Layer Attributes - Mandatory
  NameAttributeFlatten: 'NameAttributeFlatten',
  // Flatten Layer Attributes - Optional
  StartDimAttributeFlatten: 'StartDimAttributeFlatten',
  EndDimAttributeFlatten: 'EndDimAttributeFlatten',
  ActvFuncAttributeFlatten: 'ActvFuncAttributeFlatten',
  NameModuleInputAttributeFlatten: 'NameModuleInputAttributeFlatten',
  InputReusedAttributeFlatten: 'InputReusedAttributeFlatten',

  EmbeddingLayer: 'EmbeddingLayer',
  // Embedding Layer Attributes - Mandatory
  NameAttributeEmbedding: 'NameAttributeEmbedding',
  NumEmbeddingsAttributeEmbedding: 'NumEmbeddingsAttributeEmbedding',
  EmbeddingDimAttributeEmbedding: 'EmbeddingDimAttributeEmbedding',
  // Embedding Layer Attributes - Optional
  ActvFuncAttributeEmbedding: 'ActvFuncAttributeEmbedding',
  NameModuleInputAttributeEmbedding: 'NameModuleInputAttributeEmbedding',
  InputReusedAttributeEmbedding: 'InputReusedAttributeEmbedding',

  DropoutLayer: 'DropoutLayer',
  // Dropout Layer Attributes - Mandatory
  NameAttributeDropout: 'NameAttributeDropout',
  RateAttributeDropout: 'RateAttributeDropout',
  // Dropout Layer Attributes - Optional
  NameModuleInputAttributeDropout: 'NameModuleInputAttributeDropout',
  InputReusedAttributeDropout: 'InputReusedAttributeDropout',

  LayerNormalizationLayer: 'LayerNormalizationLayer',
  // LayerNormalization Layer Attributes - Mandatory
  NameAttributeLayerNormalization: 'NameAttributeLayerNormalization',
  NormalizedShapeAttributeLayerNormalization: 'NormalizedShapeAttributeLayerNormalization',
  // LayerNormalization Layer Attributes - Optional
  ActvFuncAttributeLayerNormalization: 'ActvFuncAttributeLayerNormalization',
  NameModuleInputAttributeLayerNormalization: 'NameModuleInputAttributeLayerNormalization',
  InputReusedAttributeLayerNormalization: 'InputReusedAttributeLayerNormalization',

  BatchNormalizationLayer: 'BatchNormalizationLayer',
  // BatchNormalization Layer Attributes - Mandatory
  NameAttributeBatchNormalization: 'NameAttributeBatchNormalization',
  NumFeaturesAttributeBatchNormalization: 'NumFeaturesAttributeBatchNormalization',
  DimensionAttributeBatchNormalization: 'DimensionAttributeBatchNormalization',
  // BatchNormalization Layer Attributes - Optional
  ActvFuncAttributeBatchNormalization: 'ActvFuncAttributeBatchNormalization',
  NameModuleInputAttributeBatchNormalization: 'NameModuleInputAttributeBatchNormalization',
  InputReusedAttributeBatchNormalization: 'InputReusedAttributeBatchNormalization',

  TensorOp: 'TensorOp',
  // TensorOp Attributes - Mandatory
  NameAttributeTensorOp: 'NameAttributeTensorOp',
  TnsTypeAttributeTensorOp: 'TnsTypeAttributeTensorOp',
  // TensorOp Attributes - Optional
  ConcatenateDimAttributeTensorOp: 'ConcatenateDimAttributeTensorOp',
  LayersOfTensorsAttributeTensorOp: 'LayersOfTensorsAttributeTensorOp',
  ReshapeDimAttributeTensorOp: 'ReshapeDimAttributeTensorOp',
  TransposeDimAttributeTensorOp: 'TransposeDimAttributeTensorOp',
  PermuteDimAttributeTensorOp: 'PermuteDimAttributeTensorOp',
  InputReusedAttributeTensorOp: 'InputReusedAttributeTensorOp',

  Configuration: 'Configuration',
  // Configuration Attributes - Mandatory
  BatchSizeAttributeConfiguration: 'BatchSizeAttributeConfiguration',
  EpochsAttributeConfiguration: 'EpochsAttributeConfiguration',
  LearningRateAttributeConfiguration: 'LearningRateAttributeConfiguration',
  OptimizerAttributeConfiguration: 'OptimizerAttributeConfiguration',
  LossFunctionAttributeConfiguration: 'LossFunctionAttributeConfiguration',
  MetricsAttributeConfiguration: 'MetricsAttributeConfiguration',
  // Configuration Attributes - Optional
  WeightDecayAttributeConfiguration: 'WeightDecayAttributeConfiguration',
  MomentumAttributeConfiguration: 'MomentumAttributeConfiguration',

  // Section elements for sidebar organization
  NNSectionTitle: 'NNSectionTitle',
  NNSectionSeparator: 'NNSectionSeparator',

  // Container and Reference elements
  NNContainer: 'NNContainer',
  NNReference: 'NNReference',
} as const;

export const NNRelationshipType = {
  NNNext: 'NNNext', // NN-specific unidirectional with "next" label
  NNComposition: 'NNComposition', // NN-specific composition (diamond always on NNContainer side)
} as const;
