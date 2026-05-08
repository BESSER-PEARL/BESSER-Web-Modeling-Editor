import { makeNNLayerComponent } from "./_NNLayerBase"

/**
 * SA-5 `PoolingLayer`. Note: the `dimension` slug is shared with
 * `BatchNormalizationLayer`; the migrator stores it in
 * `attributes['pooling.dimension']` for unambiguous round-tripping.
 */
export const PoolingLayer = makeNNLayerComponent("PoolingLayer", "Pooling", "#E0F7FA")
