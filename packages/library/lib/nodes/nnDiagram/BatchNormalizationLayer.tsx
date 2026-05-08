import { makeNNLayerComponent } from "./_NNLayerBase"

/**
 * SA-5 `BatchNormalizationLayer`. Note: the `dimension` slug is shared
 * with `PoolingLayer`; the migrator stores it in
 * `attributes['batch_normalization.dimension']` so the round-trip
 * remains unambiguous (open question #2 resolution).
 */
export const BatchNormalizationLayer = makeNNLayerComponent(
  "BatchNormalizationLayer",
  "BatchNorm",
  "#E1F5FE"
)
