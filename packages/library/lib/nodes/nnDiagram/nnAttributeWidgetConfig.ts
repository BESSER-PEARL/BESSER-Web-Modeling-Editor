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

export type WidgetType =
  | "text"
  | "dropdown"
  | "multiselect"
  | "predecessor"
  | "layers_of_tensors"
  /** List built by appending options one at a time (duplicates allowed),
   * e.g. `actual_vars = [output, hidden]` — one entry per input tensor. */
  | "append_list"
  | "subscript_indices"
  | "repeat_dim"
  | "pad_amount"

/** Declared value type of an attribute; drives the text validators
 * (`nnAttributeValidators.ts`). Mirrors the v3 `attributeType`. */
export type AttributeValueType = "int" | "float" | "List" | "bool" | "str"

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
  /** Declared value type (validator dispatch). */
  valueType?: AttributeValueType
  /** i18n key of the help text shown under the row while enabled. */
  helpTextKey?: string
  /** i18n key of the text-field placeholder (default `popup.nn.row.valuePlaceholder`). */
  placeholderKey?: string
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
/**
 * The optional attributes each `tns_type` owns, beyond the ones every
 * TensorOp offers (`TNS_TYPE_SHARED_ATTRIBUTES` plus the output variable).
 * Single source of truth for the inspector's row filter and for the
 * pruning applied when `tns_type` changes (smart-gen
 * `nn-attribute-widget-config.ts::TNS_TYPE_ATTRIBUTES`).
 */
export const TNS_TYPE_ATTRIBUTES: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    reshape: ["reshape_dim"],
    concatenate: ["concatenate_dim", "actual_vars"],
    transpose: ["transpose_dim"],
    permute: ["permute_dim"],
    multiply: [],
    matmultiply: [],
    split: ["split_dim", "split_sizes"],
    binop_add: ["actual_vars"],
    binop_subtract: ["actual_vars"],
    binop_multiply: ["actual_vars"],
    binop_divide: ["actual_vars"],
    binop_floor_divide: ["actual_vars"],
    mean: ["reduce_dim"],
    max: ["reduce_dim", "reduce_keepdims"],
    squeeze: ["reduce_dim"],
    unsqueeze: ["reduce_dim"],
    shape_dim: ["reduce_dim"],
    normalize: ["reduce_dim"],
    repeat: ["repeat_dim"],
    zeros_like: [],
    interpolate: ["interpolate_size", "interpolate_scale", "interpolate_mode"],
    pad: ["pad_amount", "pad_mode", "pad_value"],
    dropout: ["dropout_rate", "dropout_training_aware"],
    subscript: ["subscript_indices"],
    identity: [],
  })

/** The tns_type values a TensorOp can take — the keys of
 * `TNS_TYPE_ATTRIBUTES`, alphabetically (backend `ALLOWED_TENSOR_OP_TYPES`). */
export const TNS_TYPE_OPTIONS: readonly string[] = Object.freeze(
  Object.keys(TNS_TYPE_ATTRIBUTES).sort()
)

/** Optional attributes every tns_type offers. */
export const TNS_TYPE_SHARED_ATTRIBUTES: readonly string[] = [
  "layers_of_tensors",
  "input_reused",
  "permute_in",
  "permute_out",
  "input_var",
]

/** `split` returns several tensors, so it names them with `output_vars`. */
export function getTnsTypeOutputAttribute(tnsType: string): string {
  return tnsType === "split" ? "output_vars" : "output_var"
}

/** Every optional attribute that belongs to one tns_type but not to all. */
export const TNS_TYPE_SPECIFIC_ATTRIBUTES: readonly string[] = Array.from(
  new Set([...Object.values(TNS_TYPE_ATTRIBUTES).flat(), "output_vars"])
)

/** The optional attribute slugs a tns_type offers, shared ones included. */
export function getTnsTypeAttributeNames(tnsType: string): string[] {
  return [
    ...TNS_TYPE_SHARED_ATTRIBUTES,
    ...(TNS_TYPE_ATTRIBUTES[tnsType] ?? []),
    getTnsTypeOutputAttribute(tnsType),
  ]
}

/**
 * `layers_of_tensors` operand shape per tns_type:
 * - unary: 1 layer/tensorop name
 * - binary: 2 operands, each a name OR a numeric literal
 * - double: 2 names only
 * - n-ary: N >= 2 names (concatenate)
 */
export type TnsTypeCategory = "unary" | "binary" | "double" | "n-ary"

export function getTnsTypeCategory(tnsType: string): TnsTypeCategory {
  if (tnsType === "concatenate") return "n-ary"
  if (
    [
      "binop_add",
      "binop_subtract",
      "binop_multiply",
      "binop_divide",
      "binop_floor_divide",
      "multiply",
    ].includes(tnsType)
  ) {
    return "binary"
  }
  if (tnsType === "matmultiply") return "double"
  return "unary"
}

export const PAD_MODE_OPTIONS = ["constant", "reflect", "replicate"] as const
export const INTERPOLATE_MODE_OPTIONS = [
  "nearest",
  "linear",
  "bilinear",
  "bicubic",
  "trilinear",
  "area",
  "nearest-exact",
  "lanczos3",
  "lanczos5",
  "gaussian",
  "mitchellcubic",
] as const
export const DROPOUT_DIMENSION_OPTIONS = ["1D", "2D", "3D"] as const
export const ACTUAL_VARS_OPTIONS = ["output", "hidden"] as const
/** Sentinel predecessor meaning "the network's own input" (smart-gen d128be4f). */
export const NN_INPUT_MODULE = "INPUT"
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
// Configuration whitelists — single source of truth is the backend
// (`nn_diagram_processor.py` `_ALLOWED_OPTIMIZERS` /
// `_ALLOWED_LOSS_FUNCTIONS` / `_ALLOWED_METRICS`), identical to
// develop's frontend lists in `nn-attribute-update.tsx`.
export const OPTIMIZER_OPTIONS = ["sgd", "adam", "adamW", "adagrad"] as const
export const LOSS_FUNCTION_OPTIONS = [
  "crossentropy",
  "binary_crossentropy",
  "mse",
] as const
export const METRICS_OPTIONS = [
  "accuracy",
  "precision",
  "recall",
  "f1-score",
  "mae",
] as const

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
  // Only Pooling and BatchNormalization disambiguate (backend
  // `_LAYER_KIND_PREFIX`); DropoutLayer's own optional `dimension` is
  // stored plain.
  if (!QUALIFIED_LAYER_KINDS.has(layerKind)) return slug
  return `${kindToSlugPrefix(layerKind)}.${slug}`
}

const QUALIFIED_LAYER_KINDS: ReadonlySet<string> = new Set([
  "PoolingLayer",
  "BatchNormalizationLayer",
])

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
  valueType: "str",
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

/** Optional boolean dropdown row. */
const boolField = (
  slug: string,
  defaultValue: "true" | "false"
): AttributeWidgetConfig => ({
  slug,
  widget: "dropdown",
  options: BOOLEAN_OPTIONS,
  defaultValue,
  label: slug,
  valueType: "bool",
})

/** Optional free-text row. */
const textField = (
  slug: string,
  valueType: AttributeValueType = "str",
  extra: Partial<AttributeWidgetConfig> = {}
): AttributeWidgetConfig => ({
  slug,
  widget: "text",
  label: slug,
  valueType,
  ...extra,
})

const INPUT_REUSED_FIELD = boolField("input_reused", "false")
const PERMUTE_IN_FIELD = boolField("permute_in", "false")
const PERMUTE_OUT_FIELD = boolField("permute_out", "false")
const BIAS_FIELD = boolField("bias", "true")
const IS_LAYER_CALL_FIELD = boolField("is_layer_call", "false")
/** Explicit variable names for the forward pass (smart-gen efd85b50):
 * the variable this module reads and the one it writes. */
const INPUT_VAR_FIELD = textField("input_var")
const OUTPUT_VAR_FIELD = textField("output_var")

/** Fields every layer inherits from `Layer` (backend
 * `_append_base_layer_fields`). */
const BASE_LAYER_VAR_FIELDS: AttributeWidgetConfig[] = [
  IS_LAYER_CALL_FIELD,
  INPUT_VAR_FIELD,
  OUTPUT_VAR_FIELD,
]

/** Conv (1D/2D/3D) shared schema; list shapes specialise per kind via
 * `getListExpectation`. */
const CONV_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "kernel_dim",
    widget: "text",
    label: "kernel_dim",
    mandatory: true,
    valueType: "List",
  },
  {
    slug: "out_channels",
    widget: "text",
    label: "out_channels",
    mandatory: true,
    valueType: "int",
  },
  textField("stride_dim", "List"),
  textField("in_channels", "int"),
  textField("padding_amount", "int"),
  {
    slug: "padding_type",
    widget: "dropdown",
    options: PADDING_OPTIONS,
    defaultValue: "valid",
    label: "padding_type",
  },
  textField("dilation", "List"),
  textField("groups", "int"),
  BIAS_FIELD,
  ...BASE_LAYER_VAR_FIELDS,
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  PERMUTE_IN_FIELD,
  PERMUTE_OUT_FIELD,
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
  textField("kernel_dim", "List"),
  textField("stride_dim", "List"),
  textField("padding_amount", "int"),
  {
    slug: "padding_type",
    widget: "dropdown",
    options: PADDING_OPTIONS,
    defaultValue: "valid",
    label: "padding_type",
  },
  textField("output_dim", "List"),
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  PERMUTE_IN_FIELD,
  PERMUTE_OUT_FIELD,
  ...BASE_LAYER_VAR_FIELDS,
]

/** RNN-family `actv_func` defaults to `tanh` in v3 (PyTorch's
 * `RNN`/`LSTM`/`GRU` activation default), distinct from the
 * convolutional `relu` baseline. */
const RECURRENT_ACTV_FUNC_FIELD: AttributeWidgetConfig = {
  slug: "actv_func",
  widget: "dropdown",
  options: ACTV_FUNC_OPTIONS,
  defaultValue: "tanh",
  label: "actv_func",
}

const RECURRENT_BASE_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "hidden_size",
    widget: "text",
    label: "hidden_size",
    mandatory: true,
    valueType: "int",
  },
  // V3 default = 'full' (not 'last').
  {
    slug: "return_type",
    widget: "dropdown",
    options: RETURN_OPTIONS,
    defaultValue: "full",
    label: "return_type",
  },
  textField("input_size", "int"),
  boolField("bidirectional", "false"),
  textField("dropout", "float"),
  // V3 default = 'true' (batch dimension leading).
  boolField("batch_first", "true"),
  RECURRENT_ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  BIAS_FIELD,
  // Initial hidden state source + recurrent state variables.
  textField("hx_source"),
  ...BASE_LAYER_VAR_FIELDS,
  textField("hidden_state_var"),
]

const RECURRENT_FIELDS: AttributeWidgetConfig[] = [
  ...RECURRENT_BASE_FIELDS,
  boolField("hidden_unused", "false"),
  textField("hidden_subscript_source"),
  textField("hidden_subscript_target"),
]

/** LSTM adds the cell-state pair. */
const LSTM_FIELDS: AttributeWidgetConfig[] = [
  ...RECURRENT_BASE_FIELDS,
  textField("cell_state_var"),
  boolField("hidden_unused", "false"),
  boolField("cell_unused", "false"),
  textField("hidden_subscript_source"),
  textField("hidden_subscript_target"),
]

const LINEAR_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "out_features",
    widget: "text",
    label: "out_features",
    mandatory: true,
    valueType: "int",
  },
  textField("in_features", "int"),
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  BIAS_FIELD,
  ...BASE_LAYER_VAR_FIELDS,
]

const FLATTEN_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  textField("start_dim", "int"),
  textField("end_dim", "int"),
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  ...BASE_LAYER_VAR_FIELDS,
]

const EMBEDDING_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "num_embeddings",
    widget: "text",
    label: "num_embeddings",
    mandatory: true,
    valueType: "int",
  },
  {
    slug: "embedding_dim",
    widget: "text",
    label: "embedding_dim",
    mandatory: true,
    valueType: "int",
  },
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  textField("padding_idx", "int"),
  ...BASE_LAYER_VAR_FIELDS,
  PERMUTE_IN_FIELD,
  PERMUTE_OUT_FIELD,
]

const DROPOUT_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "rate",
    widget: "text",
    label: "rate",
    mandatory: true,
    valueType: "float",
  },
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  // Optional here and stored plain (only Pooling / BatchNorm qualify it).
  {
    slug: "dimension",
    widget: "dropdown",
    options: DROPOUT_DIMENSION_OPTIONS,
    defaultValue: "1D",
    label: "dimension",
  },
  ...BASE_LAYER_VAR_FIELDS,
  PERMUTE_IN_FIELD,
  PERMUTE_OUT_FIELD,
]

const LAYER_NORM_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "normalized_shape",
    widget: "text",
    label: "normalized_shape",
    mandatory: true,
    valueType: "List",
  },
  ACTV_FUNC_FIELD,
  NAME_MODULE_INPUT_FIELD,
  INPUT_REUSED_FIELD,
  textField("eps", "float", { defaultValue: "1e-5" }),
  boolField("affine", "true"),
  ...BASE_LAYER_VAR_FIELDS,
]

const BATCH_NORM_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  {
    slug: "num_features",
    widget: "text",
    label: "num_features",
    mandatory: true,
    valueType: "int",
  },
  // Collision-aware: stored as `batch_normalization.dimension`.
  // V3 default = '2D'.
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
  textField("eps", "float", { defaultValue: "1e-5" }),
  textField("momentum", "float", { defaultValue: "0.1" }),
  boolField("affine", "true"),
  boolField("track_running_stats", "true"),
  PERMUTE_IN_FIELD,
  PERMUTE_OUT_FIELD,
  ...BASE_LAYER_VAR_FIELDS,
]

// V3 TensorOp shipped defaults per `tns_type` branch (e.g.
// `reshape_dim = '[-1]'`, `transpose_dim = '[0, 1]'`). Which rows are
// offered for the current `tns_type` comes from `TNS_TYPE_ATTRIBUTES`.
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
  textField("concatenate_dim", "int", { defaultValue: "0" }),
  {
    slug: "layers_of_tensors",
    widget: "layers_of_tensors",
    label: "layers_of_tensors",
    defaultValue: "[]",
    valueType: "List",
  },
  textField("reshape_dim", "List", { defaultValue: "[-1]" }),
  textField("transpose_dim", "List", { defaultValue: "[0, 1]" }),
  textField("permute_dim", "List", { defaultValue: "[0, 1, 2]" }),
  INPUT_REUSED_FIELD,
  textField("reduce_dim", "int"),
  boolField("reduce_keepdims", "false"),
  textField("shape_dim", "int"),
  {
    slug: "actual_vars",
    widget: "append_list",
    options: ACTUAL_VARS_OPTIONS,
    defaultValue: "[]",
    label: "actual_vars",
    valueType: "List",
    helpTextKey: "popup.nn.help.actual_vars",
  },
  {
    slug: "subscript_indices",
    widget: "subscript_indices",
    label: "subscript_indices",
    helpTextKey: "popup.nn.help.subscript_indices",
  },
  {
    slug: "repeat_dim",
    widget: "repeat_dim",
    label: "repeat_dim",
    valueType: "List",
    helpTextKey: "popup.nn.help.repeat_dim",
  },
  textField("interpolate_size", "str", {
    helpTextKey: "popup.nn.help.interpolate_size",
  }),
  textField("interpolate_scale", "float"),
  {
    slug: "interpolate_mode",
    widget: "dropdown",
    options: INTERPOLATE_MODE_OPTIONS,
    defaultValue: "bilinear",
    label: "interpolate_mode",
  },
  {
    slug: "pad_amount",
    widget: "pad_amount",
    label: "pad_amount",
    defaultValue: "[]",
    helpTextKey: "popup.nn.help.pad_amount",
  },
  {
    slug: "pad_mode",
    widget: "dropdown",
    options: PAD_MODE_OPTIONS,
    defaultValue: "constant",
    label: "pad_mode",
  },
  textField("pad_value", "float", { defaultValue: "0.0" }),
  textField("dropout_rate", "float"),
  boolField("dropout_training_aware", "false"),
  textField("split_dim", "int", { helpTextKey: "popup.nn.help.split_dim" }),
  textField("split_sizes", "List", {
    helpTextKey: "popup.nn.help.split_sizes",
  }),
  PERMUTE_IN_FIELD,
  PERMUTE_OUT_FIELD,
  INPUT_VAR_FIELD,
  OUTPUT_VAR_FIELD,
  textField("output_vars", "List", { defaultValue: "[]" }),
]

// V3 Configuration shipped string defaults for every mandatory training
// field. `weight_decay` / `momentum` defaults live in NN_ATTRIBUTE_DEFAULTS.
const CONFIGURATION_FIELDS: AttributeWidgetConfig[] = [
  {
    slug: "batch_size",
    widget: "text",
    label: "batch_size",
    mandatory: true,
    valueType: "int",
  },
  {
    slug: "epochs",
    widget: "text",
    label: "epochs",
    mandatory: true,
    valueType: "int",
  },
  {
    slug: "learning_rate",
    widget: "text",
    label: "learning_rate",
    mandatory: true,
    valueType: "float",
  },
  {
    slug: "optimizer",
    widget: "dropdown",
    options: OPTIMIZER_OPTIONS,
    label: "optimizer",
    mandatory: true,
    defaultValue: "adam",
  },
  {
    slug: "loss_function",
    widget: "dropdown",
    options: LOSS_FUNCTION_OPTIONS,
    label: "loss_function",
    mandatory: true,
    defaultValue: "crossentropy",
  },
  // Stored value uses the canonical bracketed form (`[accuracy, mae]`)
  // emitted by the backend `_fmt_value` and parsed by
  // `create_configuration`.
  {
    slug: "metrics",
    widget: "multiselect",
    options: METRICS_OPTIONS,
    label: "metrics",
    mandatory: true,
    defaultValue: "[accuracy]",
  },
  textField("weight_decay", "float"),
  textField("momentum", "float"),
]

const DATASET_FIELDS: AttributeWidgetConfig[] = [
  NAME_FIELD,
  // V3 default = 'path/to/data'.
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
  boolField("normalize", "false"),
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
  LSTMLayer: LSTM_FIELDS,
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
    /* Extended attributes (smart-gen efd85b50 … 34060d56). */
    EpsAttributeBatchNormalization: "eps",
    MomentumAttributeBatchNormalization: "momentum",
    AffineAttributeBatchNormalization: "affine",
    TrackRunningStatsAttributeBatchNormalization: "track_running_stats",
    IsLayerCallAttributeBatchNormalization: "is_layer_call",
    InputVarAttributeBatchNormalization: "input_var",
    OutputVarAttributeBatchNormalization: "output_var",
    DilationAttributeConv1D: "dilation",
    GroupsAttributeConv1D: "groups",
    BiasAttributeConv1D: "bias",
    IsLayerCallAttributeConv1D: "is_layer_call",
    InputVarAttributeConv1D: "input_var",
    OutputVarAttributeConv1D: "output_var",
    DilationAttributeConv2D: "dilation",
    GroupsAttributeConv2D: "groups",
    BiasAttributeConv2D: "bias",
    IsLayerCallAttributeConv2D: "is_layer_call",
    InputVarAttributeConv2D: "input_var",
    OutputVarAttributeConv2D: "output_var",
    DilationAttributeConv3D: "dilation",
    GroupsAttributeConv3D: "groups",
    BiasAttributeConv3D: "bias",
    IsLayerCallAttributeConv3D: "is_layer_call",
    InputVarAttributeConv3D: "input_var",
    OutputVarAttributeConv3D: "output_var",
    DimensionAttributeDropout: "dimension",
    IsLayerCallAttributeDropout: "is_layer_call",
    InputVarAttributeDropout: "input_var",
    OutputVarAttributeDropout: "output_var",
    PermuteInAttributeDropout: "permute_in",
    PermuteOutAttributeDropout: "permute_out",
    PaddingIdxAttributeEmbedding: "padding_idx",
    IsLayerCallAttributeEmbedding: "is_layer_call",
    InputVarAttributeEmbedding: "input_var",
    OutputVarAttributeEmbedding: "output_var",
    PermuteInAttributeEmbedding: "permute_in",
    PermuteOutAttributeEmbedding: "permute_out",
    IsLayerCallAttributeFlatten: "is_layer_call",
    InputVarAttributeFlatten: "input_var",
    OutputVarAttributeFlatten: "output_var",
    BiasAttributeGRU: "bias",
    HxSourceAttributeGRU: "hx_source",
    IsLayerCallAttributeGRU: "is_layer_call",
    InputVarAttributeGRU: "input_var",
    OutputVarAttributeGRU: "output_var",
    HiddenStateVarAttributeGRU: "hidden_state_var",
    HiddenUnusedAttributeGRU: "hidden_unused",
    HiddenSubscriptSourceAttributeGRU: "hidden_subscript_source",
    HiddenSubscriptTargetAttributeGRU: "hidden_subscript_target",
    EpsAttributeLayerNormalization: "eps",
    AffineAttributeLayerNormalization: "affine",
    IsLayerCallAttributeLayerNormalization: "is_layer_call",
    InputVarAttributeLayerNormalization: "input_var",
    OutputVarAttributeLayerNormalization: "output_var",
    BiasAttributeLinear: "bias",
    IsLayerCallAttributeLinear: "is_layer_call",
    InputVarAttributeLinear: "input_var",
    OutputVarAttributeLinear: "output_var",
    BiasAttributeLSTM: "bias",
    HxSourceAttributeLSTM: "hx_source",
    IsLayerCallAttributeLSTM: "is_layer_call",
    InputVarAttributeLSTM: "input_var",
    OutputVarAttributeLSTM: "output_var",
    HiddenStateVarAttributeLSTM: "hidden_state_var",
    CellStateVarAttributeLSTM: "cell_state_var",
    HiddenUnusedAttributeLSTM: "hidden_unused",
    CellUnusedAttributeLSTM: "cell_unused",
    HiddenSubscriptSourceAttributeLSTM: "hidden_subscript_source",
    HiddenSubscriptTargetAttributeLSTM: "hidden_subscript_target",
    IsLayerCallAttributePooling: "is_layer_call",
    InputVarAttributePooling: "input_var",
    OutputVarAttributePooling: "output_var",
    BiasAttributeRNN: "bias",
    HxSourceAttributeRNN: "hx_source",
    IsLayerCallAttributeRNN: "is_layer_call",
    InputVarAttributeRNN: "input_var",
    OutputVarAttributeRNN: "output_var",
    HiddenStateVarAttributeRNN: "hidden_state_var",
    HiddenUnusedAttributeRNN: "hidden_unused",
    HiddenSubscriptSourceAttributeRNN: "hidden_subscript_source",
    HiddenSubscriptTargetAttributeRNN: "hidden_subscript_target",
    ReduceDimAttributeTensorOp: "reduce_dim",
    ReduceKeepdimAttributeTensorOp: "reduce_keepdims",
    ShapeDimAttributeTensorOp: "shape_dim",
    ActualVarsAttributeTensorOp: "actual_vars",
    SubscriptIndicesAttributeTensorOp: "subscript_indices",
    RepeatDimAttributeTensorOp: "repeat_dim",
    InterpolateSizeAttributeTensorOp: "interpolate_size",
    InterpolateScaleAttributeTensorOp: "interpolate_scale",
    InterpolateModeAttributeTensorOp: "interpolate_mode",
    PadAmountAttributeTensorOp: "pad_amount",
    PadModeAttributeTensorOp: "pad_mode",
    PadValueAttributeTensorOp: "pad_value",
    DropoutRateAttributeTensorOp: "dropout_rate",
    DropoutTrainingAwareAttributeTensorOp: "dropout_training_aware",
    SplitDimAttributeTensorOp: "split_dim",
    SplitSizesAttributeTensorOp: "split_sizes",
    PermuteInAttributeTensorOp: "permute_in",
    PermuteOutAttributeTensorOp: "permute_out",
    InputVarAttributeTensorOp: "input_var",
    OutputVarAttributeTensorOp: "output_var",
    OutputVarsAttributeTensorOp: "output_vars",
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
