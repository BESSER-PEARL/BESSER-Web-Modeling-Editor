/**
 * SA-5 NN attribute validation defaults & list-shape helpers. Ported
 * from `packages/editor/.../nn-validation-defaults.ts`. Pure, no React,
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
  })

/** Look up the default text for a given slug, falling back to the
 * stored value (when present) and finally an empty string. */
export function getAttributeDefaultValue(slug: string, currentValue?: string): string {
  return NN_ATTRIBUTE_DEFAULTS[slug] ?? currentValue ?? ""
}

/** Strict integer-list shape (e.g. `[1, 2, 3]`). */
export const LIST_STRICT_REGEX = /^\[\s*-?\d+(\s*,\s*-?\d+)*\s*\]$/
/** Permissive integer-list shape (allows partial typing). */
export const LIST_PERMISSIVE_REGEX = /^(\[(-?\d+(\s*,\s*-?\d+)*(\s*,?\s*)?)?\]?)$/

export interface ListExpectation {
  /** Required element count, or `null` when unconstrained. */
  count: number | null
  /** Worked example string for the placeholder. */
  example: string
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
  }
  if (layerKind === "Conv2DLayer") {
    if (slug === "kernel_dim") return { count: 2, example: "[3, 3]" }
    if (slug === "stride_dim") return { count: 2, example: "[1, 1]" }
  }
  if (layerKind === "Conv3DLayer") {
    if (slug === "kernel_dim") return { count: 3, example: "[3, 3, 3]" }
    if (slug === "stride_dim") return { count: 3, example: "[1, 1, 1]" }
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
