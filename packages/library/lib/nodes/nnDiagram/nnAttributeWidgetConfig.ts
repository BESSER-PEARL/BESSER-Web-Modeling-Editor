/**
 * NN attribute widget configuration. Single source of truth for
 * both the inline panel editor (`NNComponentEditPanel`) and the v3 ↔ v4
 * version converter (`migrateNNDiagramV3ToV4`). Ported verbatim from
 * `v3 source: nn-diagram/nn-attribute-widget-config.ts`
 * but rewritten to be data-only (no React, no Redux) and to key on the
 * **v4 attribute slug** (snake_case, layer suffix stripped) instead of
 * the v3 element-type string.
 *
 * Per-layer schema is also exported (`LAYER_ATTRIBUTE_SCHEMA`) so the
 * panel can render a stable ordered field list per layer kind without
 * round-tripping through the v3 element registry.
 *
 * (DimensionAttribute slug collision) — the slug
 * `dimension` is shared between `DimensionAttributePooling` and
 * `DimensionAttributeBatchNormalization`. disambiguates at the
 * boundary: the migrator (and the inspector) keys on
 * `<layer_kind>.<slug>` for these collision-prone slugs and falls back
 * to the plain slug for everything else. already shipped the
 * matching backend disambiguation — this module mirrors that contract.
 */

export type WidgetType = "text" | "dropdown" | "predecessor" | "layers_of_tensors"

export interface AttributeWidgetConfig {
  /** v4 slug stored on `node.data.attributes` (or qualified slug when
   * the slug collides across layer kinds — see `qualifySlug`). */
  slug: string
  widget: WidgetType
  /** Fixed options list (only for `widget: 'dropdown'`). */
  options?: readonly string[]
  /** Fallback value when stored value is absent or not in options. */
  defaultValue?: string
  /** Free-form short label for the inline editor row. */
  label?: string
  /** Mandatory in v3; surfaced by the inspector as required. */
  mandatory?: boolean
}

/* ── Shared option lists (verbatim from v3 nn-attribute-widget-config) ─── */
export const ACTV_FUNC_OPTIONS = [
  "relu",
  "leaky_relu",
  "sigmoid",
  "softmax",
  "tanh",
] as const
export const BOOLEAN_OPTIONS = ["true", "false"] as const
export const PADDING_OPTIONS = ["valid", "same"] as const
export const RETURN_OPTIONS = ["hidden", "last", "full"] as const
export const TNS_TYPE_OPTIONS = [
  "reshape",
  "concatenate",
  "multiply",
  "matmultiply",
  "transpose",
  "permute",
] as const
export const TASK_TYPE_OPTIONS = ["binary", "multi_class", "regression"] as const
export const INPUT_FORMAT_OPTIONS = ["csv", "images"] as const
// Include the v3 `global_*` pooling types so legacy
// fixtures (`pooling_type = 'global_average' | 'global_max'`) round
// trip without silent value reset. Mirrors the optional-attribute
// filter at `nn-component-update.tsx:649-669` which references both
// values.
export const POOLING_TYPE_OPTIONS = [
  "average",
  "max",
  "adaptive_average",
  "adaptive_max",
  "global_average",
  "global_max",
] as const
export const POOLING_DIMENSION_OPTIONS = ["1D", "2D", "3D"] as const
export const BATCHNORM_DIMENSION_OPTIONS = ["1D", "2D", "3D"] as const

/**
 * Slugs that collide across layer kinds. Lookup goes through the
 * `pooling.dimension` / `batch_normalization.dimension` namespaced form;
 * the migrator emits the qualified slug on output and reads either form
 * on input. Mirrors backend disambiguation.
 */
export const COLLIDING_SLUGS: ReadonlySet<string> = new Set(["dimension"])

/**
 * Compute the layer-qualified slug (e.g. `pooling.dimension`) for a slug
 * that appears in multiple layer kinds. For non-colliding slugs returns
 * the plain slug.
 */
export function qualifySlug(layerKind: string, slug: string): string {
  if (!COLLIDING_SLUGS.has(slug)) return slug
  return `${kindToSlugPrefix(layerKind)}.${slug}`
}

/** Layer kind (v4 node-type string) → slug prefix used in qualified attribute keys. */
export function kindToSlugPrefix(layerKind: string): string {
  switch (layerKind) {
    case "PoolingLayer":
      return "pooling"
    case "BatchNormalizationLayer":
      return "batch_normalization"
    case "LayerNormalizationLayer":
      return "layer_normalization"
    case "Conv1DLayer":
      return "conv1d"
    case "Conv2DLayer":
      return "conv2d"
    case "Conv3DLayer":
      return "conv3d"
    case "RNNLayer":
      return "rnn"
    case "LSTMLayer":
      return "lstm"
    case "GRULayer":
      return "gru"
    case "LinearLayer":
      return "linear"
    case "FlattenLayer":
      return "flatten"
    case "EmbeddingLayer":
      return "embedding"
    case "DropoutLayer":
      return "dropout"
    case "TensorOp":
      return "tensor_op"
    case "Configuration":
      return "configuration"
    case "TrainingDataset":
    case "TestDataset":
      return "dataset"
    default:
      return layerKind.toLowerCase()
  }
}

/** Convenience: `attributes` getter that hides the qualified-slug detail. */
export function getAttribute(
  attributes: Record<string, unknown>,
  layerKind: string,
  slug: string
): unknown {
  if (COLLIDING_SLUGS.has(slug)) {
    const q = qualifySlug(layerKind, slug)
    if (q in attributes) return attributes[q]
  }
  return attributes[slug]
}

/** Convenience: `attributes` setter mirror of `getAttribute`. */
export function setAttribute(
  attributes: Record<string, unknown>,
  layerKind: string,
  slug: string,
  value: unknown
): Record<string, unknown> {
  const out = { ...attributes }
  const key = COLLIDING_SLUGS.has(slug) ? qualifySlug(layerKind, slug) : slug
  out[key] = value
  return out
}

/* -------------------------------------------------------------------------- */
/* Per-layer attribute schemas                                                 */
/* -------------------------------------------------------------------------- */

const NAME_FIELD: AttributeWidgetConfig = {
  slug: "name",
  widget: "text",
  label: "name",
  mandatory: true,
}

const ACTV_FUNC_FIELD: AttributeWidgetConfig = {
  slug: "actv_func",
  widget: "dropdown",
  options: ACTV_FUNC_OPTIONS,
  defaultValue: "relu",
  label: "actv_func",
}

const NAME_MODULE_INPUT_FIELD: AttributeWidgetConfig = {
  slug: "name_module_input",
  widget: "predecessor",
  label: "name_module_input",
}

const INPUT_REUSED_FIELD: AttributeWidgetConfig = {
  slug: "input_reused",
  widget: "dropdown",
  options: BOOLEAN_OPTIONS,
  defaultValue: "false",
  label: "input_reused",
}

/** Conv (1D/2D/3D) shared schema; each kind specialises the slug-only
 * fields by example value (see migrator). */
const CONV_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  { slug: "kernel_dim", widget: "text", label: "kernel_dim", mandatory: true },
  {
    slug: "out_channels",
    widget: "text",
    label: "out_channels",
    mandatory: true,
  },
  { slug: "stride_dim", widget: "text", label: "stride_dim" },
  { slug: "in_channels", widget: "text", label: "in_channels" },
  { slug: "padding_amount", widget: "text", label: "padding_amount" },
  {
    slug: "padding_type",
    widget: "dropdown",
    options: PADDING_OPTIONS,
    defaultValue: "valid",
    label: "padding_type",
  },
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  {
    slug: "permute_in",
    widget: "dropdown",
    options: BOOLEAN_OPTIONS,
    defaultValue: "false",
    label: "permute_in",
  },
  {
    slug: "permute_out",
    widget: "dropdown",
    options: BOOLEAN_OPTIONS,
    defaultValue: "false",
    label: "permute_out",
  },
]

const POOLING_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "pooling_type",
    widget: "dropdown",
    options: POOLING_TYPE_OPTIONS,
    defaultValue: "max",
    label: "pooling_type",
    mandatory: true,
  },
  // Collision-aware: stored as `pooling.dimension` on a Pooling node.
  {
    slug: "dimension",
    widget: "dropdown",
    options: POOLING_DIMENSION_OPTIONS,
    defaultValue: "2D",
    label: "dimension",
    mandatory: true,
  },
  { slug: "kernel_dim", widget: "text", label: "kernel_dim" },
  { slug: "stride_dim", widget: "text", label: "stride_dim" },
  { slug: "padding_amount", widget: "text", label: "padding_amount" },
  {
    slug: "padding_type",
    widget: "dropdown",
    options: PADDING_OPTIONS,
    defaultValue: "valid",
    label: "padding_type",
  },
  { slug: "output_dim", widget: "text", label: "output_dim" },
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  {
    slug: "permute_in",
    widget: "dropdown",
    options: BOOLEAN_OPTIONS,
    defaultValue: "false",
    label: "permute_in",
  },
  {
    slug: "permute_out",
    widget: "dropdown",
    options: BOOLEAN_OPTIONS,
    defaultValue: "false",
    label: "permute_out",
  },
]

/** RNN-family `actv_func` defaults to `tanh` in v3
 * (mirrors PyTorch's `RNN`/`LSTM`/`GRU` activation default), distinct
 * from the convolutional `relu` baseline. Inlined here rather than
 * sharing `ACTV_FUNC_FIELD` so the recurrent panel renders the v3
 * default. */
const RECURRENT_ACTV_FUNC_FIELD: AttributeWidgetConfig = {
  slug: "actv_func",
  widget: "dropdown",
  options: ACTV_FUNC_OPTIONS,
  defaultValue: "tanh",
  label: "actv_func",
}

const RECURRENT_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  { slug: "hidden_size", widget: "text", label: "hidden_size", mandatory: true },
  // V3 default = 'full' (not 'last').
  {
    slug: "return_type",
    widget: "dropdown",
    options: RETURN_OPTIONS,
    defaultValue: "full",
    label: "return_type",
  },
  { slug: "input_size", widget: "text", label: "input_size" },
  {
    slug: "bidirectional",
    widget: "dropdown",
    options: BOOLEAN_OPTIONS,
    defaultValue: "false",
    label: "bidirectional",
  },
  { slug: "dropout", widget: "text", label: "dropout" },
  // V3 default = 'true' (PyTorch-style channel-first
  // tensors with the batch dimension leading).
  {
    slug: "batch_first",
    widget: "dropdown",
    options: BOOLEAN_OPTIONS,
    defaultValue: "true",
    label: "batch_first",
  },
  RECURRENT_ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
]

const LINEAR_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "out_features",
    widget: "text",
    label: "out_features",
    mandatory: true,
  },
  { slug: "in_features", widget: "text", label: "in_features" },
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
]

const FLATTEN_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  { slug: "start_dim", widget: "text", label: "start_dim" },
  { slug: "end_dim", widget: "text", label: "end_dim" },
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
]

const EMBEDDING_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "num_embeddings",
    widget: "text",
    label: "num_embeddings",
    mandatory: true,
  },
  {
    slug: "embedding_dim",
    widget: "text",
    label: "embedding_dim",
    mandatory: true,
  },
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
]

const DROPOUT_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  { slug: "rate", widget: "text", label: "rate", mandatory: true },
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
]

const LAYER_NORM_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "normalized_shape",
    widget: "text",
    label: "normalized_shape",
    mandatory: true,
  },
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
]

const BATCH_NORM_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "num_features",
    widget: "text",
    label: "num_features",
    mandatory: true,
  },
  // Collision-aware: stored as `batch_normalization.dimension` on a
  // BatchNormalization node.
  // V3 default = '2D' (mirrors the convolutional
  // baseline so `BatchNorm2d` lands where users expect).
  {
    slug: "dimension",
    widget: "dropdown",
    options: BATCHNORM_DIMENSION_OPTIONS,
    defaultValue: "2D",
    label: "dimension",
    mandatory: true,
  },
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
]

// V3 TensorOp shipped defaults per `tns_type` branch
// (e.g. `reshape_dim = '[-1]'`, `transpose_dim = '[0, 1]'`,
// `permute_dim = '[0, 1, 2]'`, `concatenate_dim = '0'`,
// `layers_of_tensors = '[]'`). Surfacing them as `defaultValue` here
// drives the inspector's "enable optional row" experience to a
// non-empty starter value.
const TENSOR_OP_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "tns_type",
    widget: "dropdown",
    options: TNS_TYPE_OPTIONS,
    defaultValue: "reshape",
    label: "tns_type",
    mandatory: true,
  },
  {
    slug: "concatenate_dim",
    widget: "text",
    label: "concatenate_dim",
    defaultValue: "0",
  },
  {
    slug: "layers_of_tensors",
    widget: "layers_of_tensors",
    label: "layers_of_tensors",
    defaultValue: "[]",
  },
  {
    slug: "reshape_dim",
    widget: "text",
    label: "reshape_dim",
    defaultValue: "[-1]",
  },
  {
    slug: "transpose_dim",
    widget: "text",
    label: "transpose_dim",
    defaultValue: "[0, 1]",
  },
  {
    slug: "permute_dim",
    widget: "text",
    label: "permute_dim",
    defaultValue: "[0, 1, 2]",
  },
  INPUT_REUSED_FIELD,
]

// V3 Configuration shipped string defaults for every
// mandatory training field. Surface them on the schema so the
// auto-fill effect seeds the node on drop. `weight_decay` /
// `momentum` defaults live in NN_ATTRIBUTE_DEFAULTS already.
const CONFIGURATION_FIELDS: AttributeWidgetConfig[] = [
  { slug: "batch_size", widget: "text", label: "batch_size", mandatory: true },
  { slug: "epochs", widget: "text", label: "epochs", mandatory: true },
  {
    slug: "learning_rate",
    widget: "text",
    label: "learning_rate",
    mandatory: true,
  },
  {
    slug: "optimizer",
    widget: "text",
    label: "optimizer",
    mandatory: true,
    defaultValue: "adam",
  },
  {
    slug: "loss_function",
    widget: "text",
    label: "loss_function",
    mandatory: true,
    defaultValue: "crossentropy",
  },
  {
    slug: "metrics",
    widget: "text",
    label: "metrics",
    mandatory: true,
    defaultValue: "[accuracy]",
  },
  { slug: "weight_decay", widget: "text", label: "weight_decay" },
  { slug: "momentum", widget: "text", label: "momentum" },
]

const DATASET_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  // V3 default = 'path/to/data'. Mandatory in v3, so
  // surface the placeholder default for parity with the v3 auto-fill.
  {
    slug: "path_data",
    widget: "text",
    label: "path_data",
    mandatory: true,
    defaultValue: "path/to/data",
  },
  {
    slug: "task_type",
    widget: "dropdown",
    options: TASK_TYPE_OPTIONS,
    defaultValue: "multi_class",
    label: "task_type",
  },
  {
    slug: "input_format",
    widget: "dropdown",
    options: INPUT_FORMAT_OPTIONS,
    defaultValue: "images",
    label: "input_format",
  },
  { slug: "shape", widget: "text", label: "shape" },
  {
    slug: "normalize",
    widget: "dropdown",
    options: BOOLEAN_OPTIONS,
    defaultValue: "false",
    label: "normalize",
  },
]

/**
 * Layer kind → ordered list of attribute fields. Drives the inline
 * editor render order and the round-trip converter's "expected slug
 * set" per layer.
 */
export const LAYER_ATTRIBUTE_SCHEMA: Readonly<
  Record<string, readonly AttributeWidgetConfig[]>
> = Object.freeze({
  Conv1DLayer: CONV_FIELDS,
  Conv2DLayer: CONV_FIELDS,
  Conv3DLayer: CONV_FIELDS,
  PoolingLayer: POOLING_FIELDS,
  RNNLayer: RECURRENT_FIELDS,
  LSTMLayer: RECURRENT_FIELDS,
  GRULayer: RECURRENT_FIELDS,
  LinearLayer: LINEAR_FIELDS,
  FlattenLayer: FLATTEN_FIELDS,
  EmbeddingLayer: EMBEDDING_FIELDS,
  DropoutLayer: DROPOUT_FIELDS,
  LayerNormalizationLayer: LAYER_NORM_FIELDS,
  BatchNormalizationLayer: BATCH_NORM_FIELDS,
  TensorOp: TENSOR_OP_FIELDS,
  Configuration: CONFIGURATION_FIELDS,
  TrainingDataset: DATASET_FIELDS,
  TestDataset: DATASET_FIELDS,
})

/** All v3 attribute element-type strings → v4 slug mappings.
 * Drives the migrator's collapse direction. Layers with collision-prone
 * slugs are emitted in qualified form (`pooling.dimension`) by the
 * migrator and looked up via `getAttribute` from inspectors.
 */
export const V3_ATTRIBUTE_TYPE_TO_SLUG: Readonly<Record<string, string>> =
  Object.freeze({
    /* Conv1D / Conv2D / Conv3D */
    NameAttributeConv1D: "name",
    KernelDimAttributeConv1D: "kernel_dim",
    OutChannelsAttributeConv1D: "out_channels",
    StrideDimAttributeConv1D: "stride_dim",
    InChannelsAttributeConv1D: "in_channels",
    PaddingAmountAttributeConv1D: "padding_amount",
    PaddingTypeAttributeConv1D: "padding_type",
    ActvFuncAttributeConv1D: "actv_func",
    NameModuleInputAttributeConv1D: "name_module_input",
    InputReusedAttributeConv1D: "input_reused",
    PermuteInAttributeConv1D: "permute_in",
    PermuteOutAttributeConv1D: "permute_out",

    NameAttributeConv2D: "name",
    KernelDimAttributeConv2D: "kernel_dim",
    OutChannelsAttributeConv2D: "out_channels",
    StrideDimAttributeConv2D: "stride_dim",
    InChannelsAttributeConv2D: "in_channels",
    PaddingAmountAttributeConv2D: "padding_amount",
    PaddingTypeAttributeConv2D: "padding_type",
    ActvFuncAttributeConv2D: "actv_func",
    NameModuleInputAttributeConv2D: "name_module_input",
    InputReusedAttributeConv2D: "input_reused",
    PermuteInAttributeConv2D: "permute_in",
    PermuteOutAttributeConv2D: "permute_out",

    NameAttributeConv3D: "name",
    KernelDimAttributeConv3D: "kernel_dim",
    OutChannelsAttributeConv3D: "out_channels",
    StrideDimAttributeConv3D: "stride_dim",
    InChannelsAttributeConv3D: "in_channels",
    PaddingAmountAttributeConv3D: "padding_amount",
    PaddingTypeAttributeConv3D: "padding_type",
    ActvFuncAttributeConv3D: "actv_func",
    NameModuleInputAttributeConv3D: "name_module_input",
    InputReusedAttributeConv3D: "input_reused",
    PermuteInAttributeConv3D: "permute_in",
    PermuteOutAttributeConv3D: "permute_out",

    /* Pooling — `dimension` qualifies to `pooling.dimension`. */
    NameAttributePooling: "name",
    PoolingTypeAttributePooling: "pooling_type",
    DimensionAttributePooling: "dimension",
    KernelDimAttributePooling: "kernel_dim",
    StrideDimAttributePooling: "stride_dim",
    PaddingAmountAttributePooling: "padding_amount",
    PaddingTypeAttributePooling: "padding_type",
    OutputDimAttributePooling: "output_dim",
    ActvFuncAttributePooling: "actv_func",
    NameModuleInputAttributePooling: "name_module_input",
    InputReusedAttributePooling: "input_reused",
    PermuteInAttributePooling: "permute_in",
    PermuteOutAttributePooling: "permute_out",

    /* Recurrent */
    NameAttributeRNN: "name",
    HiddenSizeAttributeRNN: "hidden_size",
    ReturnTypeAttributeRNN: "return_type",
    InputSizeAttributeRNN: "input_size",
    BidirectionalAttributeRNN: "bidirectional",
    DropoutAttributeRNN: "dropout",
    BatchFirstAttributeRNN: "batch_first",
    ActvFuncAttributeRNN: "actv_func",
    NameModuleInputAttributeRNN: "name_module_input",
    InputReusedAttributeRNN: "input_reused",

    NameAttributeLSTM: "name",
    HiddenSizeAttributeLSTM: "hidden_size",
    ReturnTypeAttributeLSTM: "return_type",
    InputSizeAttributeLSTM: "input_size",
    BidirectionalAttributeLSTM: "bidirectional",
    DropoutAttributeLSTM: "dropout",
    BatchFirstAttributeLSTM: "batch_first",
    ActvFuncAttributeLSTM: "actv_func",
    NameModuleInputAttributeLSTM: "name_module_input",
    InputReusedAttributeLSTM: "input_reused",

    NameAttributeGRU: "name",
    HiddenSizeAttributeGRU: "hidden_size",
    ReturnTypeAttributeGRU: "return_type",
    InputSizeAttributeGRU: "input_size",
    BidirectionalAttributeGRU: "bidirectional",
    DropoutAttributeGRU: "dropout",
    BatchFirstAttributeGRU: "batch_first",
    ActvFuncAttributeGRU: "actv_func",
    NameModuleInputAttributeGRU: "name_module_input",
    InputReusedAttributeGRU: "input_reused",

    /* Linear / Flatten / Embedding / Dropout */
    NameAttributeLinear: "name",
    OutFeaturesAttributeLinear: "out_features",
    InFeaturesAttributeLinear: "in_features",
    ActvFuncAttributeLinear: "actv_func",
    NameModuleInputAttributeLinear: "name_module_input",
    InputReusedAttributeLinear: "input_reused",

    NameAttributeFlatten: "name",
    StartDimAttributeFlatten: "start_dim",
    EndDimAttributeFlatten: "end_dim",
    ActvFuncAttributeFlatten: "actv_func",
    NameModuleInputAttributeFlatten: "name_module_input",
    InputReusedAttributeFlatten: "input_reused",

    NameAttributeEmbedding: "name",
    NumEmbeddingsAttributeEmbedding: "num_embeddings",
    EmbeddingDimAttributeEmbedding: "embedding_dim",
    ActvFuncAttributeEmbedding: "actv_func",
    NameModuleInputAttributeEmbedding: "name_module_input",
    InputReusedAttributeEmbedding: "input_reused",

    NameAttributeDropout: "name",
    RateAttributeDropout: "rate",
    NameModuleInputAttributeDropout: "name_module_input",
    InputReusedAttributeDropout: "input_reused",

    /* Layer / Batch normalization — `dimension` qualifies to
     * `batch_normalization.dimension` on BN. */
    NameAttributeLayerNormalization: "name",
    NormalizedShapeAttributeLayerNormalization: "normalized_shape",
    ActvFuncAttributeLayerNormalization: "actv_func",
    NameModuleInputAttributeLayerNormalization: "name_module_input",
    InputReusedAttributeLayerNormalization: "input_reused",

    NameAttributeBatchNormalization: "name",
    NumFeaturesAttributeBatchNormalization: "num_features",
    DimensionAttributeBatchNormalization: "dimension",
    ActvFuncAttributeBatchNormalization: "actv_func",
    NameModuleInputAttributeBatchNormalization: "name_module_input",
    InputReusedAttributeBatchNormalization: "input_reused",

    /* TensorOp */
    NameAttributeTensorOp: "name",
    TnsTypeAttributeTensorOp: "tns_type",
    ConcatenateDimAttributeTensorOp: "concatenate_dim",
    LayersOfTensorsAttributeTensorOp: "layers_of_tensors",
    ReshapeDimAttributeTensorOp: "reshape_dim",
    TransposeDimAttributeTensorOp: "transpose_dim",
    PermuteDimAttributeTensorOp: "permute_dim",
    InputReusedAttributeTensorOp: "input_reused",

    /* Configuration */
    BatchSizeAttributeConfiguration: "batch_size",
    EpochsAttributeConfiguration: "epochs",
    LearningRateAttributeConfiguration: "learning_rate",
    OptimizerAttributeConfiguration: "optimizer",
    LossFunctionAttributeConfiguration: "loss_function",
    MetricsAttributeConfiguration: "metrics",
    WeightDecayAttributeConfiguration: "weight_decay",
    MomentumAttributeConfiguration: "momentum",

    /* Datasets */
    NameAttributeDataset: "name",
    PathDataAttributeDataset: "path_data",
    TaskTypeAttributeDataset: "task_type",
    InputFormatAttributeDataset: "input_format",
    ShapeAttributeDataset: "shape",
    NormalizeAttributeDataset: "normalize",
  })

/**
 * Inverse of `V3_ATTRIBUTE_TYPE_TO_SLUG` keyed by `(layerKind, slug)`.
 * Used by the v4 → v3 reverse migrator to reconstruct the v3
 * attribute element-type string from the flat data.
 */
export function v3AttributeTypeFor(
  layerKind: string,
  slug: string
): string | undefined {
  // Pooling/BatchNormalization "dimension" disambiguation.
  const lookupSlug = COLLIDING_SLUGS.has(slug)
    ? slug
    : slug

  // Special-case the layer-suffixed Name slug.
  if (lookupSlug === "name") {
    switch (layerKind) {
      case "Conv1DLayer":
        return "NameAttributeConv1D"
      case "Conv2DLayer":
        return "NameAttributeConv2D"
      case "Conv3DLayer":
        return "NameAttributeConv3D"
      case "PoolingLayer":
        return "NameAttributePooling"
      case "RNNLayer":
        return "NameAttributeRNN"
      case "LSTMLayer":
        return "NameAttributeLSTM"
      case "GRULayer":
        return "NameAttributeGRU"
      case "LinearLayer":
        return "NameAttributeLinear"
      case "FlattenLayer":
        return "NameAttributeFlatten"
      case "EmbeddingLayer":
        return "NameAttributeEmbedding"
      case "DropoutLayer":
        return "NameAttributeDropout"
      case "LayerNormalizationLayer":
        return "NameAttributeLayerNormalization"
      case "BatchNormalizationLayer":
        return "NameAttributeBatchNormalization"
      case "TensorOp":
        return "NameAttributeTensorOp"
      case "TrainingDataset":
      case "TestDataset":
        return "NameAttributeDataset"
    }
  }

  // Walk the static map and find the (slug, layerKindSuffix) entry that
  // matches. Since the map is small the linear scan is fine.
  for (const [type, mappedSlug] of Object.entries(V3_ATTRIBUTE_TYPE_TO_SLUG)) {
    if (mappedSlug !== lookupSlug) continue
    if (typeMatchesLayerKind(type, layerKind)) return type
  }
  return undefined
}

function typeMatchesLayerKind(v3Type: string, layerKind: string): boolean {
  switch (layerKind) {
    case "Conv1DLayer":
      return v3Type.endsWith("Conv1D")
    case "Conv2DLayer":
      return v3Type.endsWith("Conv2D")
    case "Conv3DLayer":
      return v3Type.endsWith("Conv3D")
    case "PoolingLayer":
      return v3Type.endsWith("Pooling")
    case "RNNLayer":
      return v3Type.endsWith("RNN")
    case "LSTMLayer":
      return v3Type.endsWith("LSTM")
    case "GRULayer":
      return v3Type.endsWith("GRU")
    case "LinearLayer":
      return v3Type.endsWith("Linear")
    case "FlattenLayer":
      return v3Type.endsWith("Flatten")
    case "EmbeddingLayer":
      return v3Type.endsWith("Embedding")
    case "DropoutLayer":
      return v3Type.endsWith("Dropout")
    case "LayerNormalizationLayer":
      return v3Type.endsWith("LayerNormalization")
    case "BatchNormalizationLayer":
      return v3Type.endsWith("BatchNormalization")
    case "TensorOp":
      return v3Type.endsWith("TensorOp")
    case "Configuration":
      return v3Type.endsWith("Configuration")
    case "TrainingDataset":
    case "TestDataset":
      return v3Type.endsWith("Dataset")
    default:
      return false
  }
}

/** Convenience: returns the field schema for a layer kind, or `[]`
 * for unknown kinds (lets callers render a generic editor). */
export function getLayerSchema(
  layerKind: string
): readonly AttributeWidgetConfig[] {
  return LAYER_ATTRIBUTE_SCHEMA[layerKind] ?? []
}
