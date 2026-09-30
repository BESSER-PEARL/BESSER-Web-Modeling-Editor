/**
 * NN attribute validation defaults & list-shape helpers. Ported
 * from `v3 source: nn-validation-defaults.ts`. Pure, no React,
 * no Redux. The migrator and the inline editor both consume these.
 */

/** Per-slug fallback string value when the user clears a numeric field. */
export const NN_ATTRIBUTE_DEFAULTS: Readonly<Record<string, string>> =
  Object.freeze({
    out_channels: "16",
    in_channels: "3",
    padding_amount: "0",
    output_dim: "[16, 16]",
    out_features: "128",
    in_features: "64",
    start_dim: "1",
    end_dim: "-1",
    num_embeddings: "1000",
    embedding_dim: "128",
    rate: "0.5",
    num_features: "128",
    concatenate_dim: "0",
    hidden_size: "128",
    input_size: "64",
    dropout: "0.0",
    batch_size: "32",
    epochs: "10",
    learning_rate: "0.001",
    weight_decay: "0.0",
    momentum: "0",
    // V3-parity defaults for Configuration / Dataset /
    // TensorOp slugs that were missing from the v4 fallback table.
    optimizer: "adam",
    loss_function: "crossentropy",
    metrics: "[accuracy]",
    path_data: "path/to/data",
    reshape_dim: "[-1]",
    transpose_dim: "[0, 1]",
    permute_dim: "[0, 1, 2]",
    layers_of_tensors: "[]",
    // Extended attributes (smart-gen nn-validation-defaults.ts).
    groups: "1",
    pad_value: "0.0",
    interpolate_scale: "2.0",
    dropout_rate: "0.5",
    dropout_training_aware: "true",
    reduce_dim: "0",
    shape_dim: "0",
    split_dim: "0",
    split_sizes: "2",
  })

/** Look up the default text for a given slug, falling back to the
 * stored value (when present) and finally an empty string. */
export function getAttributeDefaultValue(slug: string, currentValue?: string): string {
  return NN_ATTRIBUTE_DEFAULTS[slug] ?? currentValue ?? ""
}

// Identifier grammars, mirrored from `NN.validate()` / the NN metamodel
// setters (besser/BUML/metamodel/nn/neural_network.py):
//   NN.input_var and Layer/TensorOp input_var  -> ^[a-zA-Z_][a-zA-Z0-9_]*$
//   TensorOp input_var may also be a comma-separated list of those
//   NN.return_vars / TensorOp output_vars      -> ^[a-zA-Z][a-zA-Z0-9_]*$ per entry
export const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/
export const IDENTIFIER_LIST_REGEX =
  /^[a-zA-Z_][a-zA-Z0-9_]*(\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*$/
/** Same list mid-typing: a trailing comma is incomplete, not yet wrong. */
export const IDENTIFIER_LIST_PARTIAL_REGEX =
  /^[a-zA-Z_][a-zA-Z0-9_]*(\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*\s*,\s*$/
/** Entries of return_vars / output_vars must start with a letter. */
export const RETURN_VAR_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/

/** Identifier lists like `[x1, x2]` (unquoted identifiers). */
export const LIST_IDENTIFIER_STRICT_REGEX =
  /^\[\s*[a-zA-Z_][a-zA-Z0-9_]*(\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*\s*\]$/
export const LIST_IDENTIFIER_PERMISSIVE_REGEX =
  /^(\[([a-zA-Z_][a-zA-Z0-9_]*(\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*(\s*,?\s*)?)?\]?)$/

/** Strict integer-list shape (e.g. `[1, 2, 3]`). */
export const LIST_STRICT_REGEX = /^\[\s*-?\d+(\s*,\s*-?\d+)*\s*\]$/
/** Permissive integer-list shape (allows partial typing). */
export const LIST_PERMISSIVE_REGEX = /^(\[(-?\d+(\s*,\s*-?\d+)*(\s*,?\s*)?)?\]?)$/

export interface ListExpectation {
  /** Required element count, or `null` when unconstrained. */
  count: number | null
  /** Worked example string for the placeholder. */
  example: string
  /** Item type: integers (default) or identifiers. */
  type?: "int" | "string"
}

/**
 * Per-(layerKind, slug) expected list shape. Replaces the v3 `getListExpectation`
 * which keyed on the v3 element-type string + walked the attributes
 * registry to find the Pooling dimension. v4 stores attributes flat, so
 * we receive the layer kind and the (already-resolved) pooling
 * dimension directly.
 */
export function getListExpectation(
  layerKind: string,
  slug: string,
  poolingDimension?: string
): ListExpectation {
  if (layerKind === "Conv1DLayer") {
    if (slug === "kernel_dim") return { count: 1, example: "[3]" }
    if (slug === "stride_dim") return { count: 1, example: "[1]" }
    if (slug === "dilation") return { count: 1, example: "[1]" }
  }
  if (layerKind === "Conv2DLayer") {
    if (slug === "kernel_dim") return { count: 2, example: "[3, 3]" }
    if (slug === "stride_dim") return { count: 2, example: "[1, 1]" }
    if (slug === "dilation") return { count: 2, example: "[1, 1]" }
  }
  if (layerKind === "Conv3DLayer") {
    if (slug === "kernel_dim") return { count: 3, example: "[3, 3, 3]" }
    if (slug === "stride_dim") return { count: 3, example: "[1, 1, 1]" }
    if (slug === "dilation") return { count: 3, example: "[1, 1, 1]" }
  }
  if (layerKind === "TensorOp") {
    if (slug === "permute_dim") return { count: null, example: "[0, 2, 1]" }
    if (slug === "reshape_dim") return { count: null, example: "[32, -1]" }
    if (slug === "repeat_dim") return { count: null, example: "[2, 3]" }
    if (slug === "output_vars") {
      return { count: null, example: "[x1, x2, x3]", type: "string" }
    }
  }
  if (layerKind === "LayerNormalizationLayer" && slug === "normalized_shape") {
    return { count: 1, example: "[-1]" }
  }
  if (layerKind === "TensorOp" && slug === "transpose_dim") {
    return { count: 2, example: "[0, 1]" }
  }
  if (layerKind === "PoolingLayer") {
    const dim = poolingDimension ?? "2D"
    if (slug === "kernel_dim" || slug === "stride_dim") {
      const isKernel = slug === "kernel_dim"
      switch (dim) {
        case "1D":
          return { count: 1, example: isKernel ? "[3]" : "[1]" }
        case "3D":
          return { count: 3, example: isKernel ? "[3, 3, 3]" : "[1, 1, 1]" }
        default:
          return { count: 2, example: isKernel ? "[3, 3]" : "[1, 1]" }
      }
    }
    if (slug === "output_dim") {
      switch (dim) {
        case "1D":
          return { count: 1, example: "[16]" }
        case "3D":
          return { count: 3, example: "[16, 16, 16]" }
        default:
          return { count: 2, example: "[16, 16]" }
      }
    }
  }
  return { count: null, example: "[1]" }
}
