import { makeNNLayerComponent } from "./_NNLayerBase"

/** `TensorOp` — reshape / concatenate / multiply / matmultiply /
 * transpose / permute. Uses the same flat `attributes` shape. */
export const TensorOp = makeNNLayerComponent("TensorOp", "TensorOp", "#FFF3E0")
