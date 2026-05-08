import { makeNNLayerComponent } from "./_NNLayerBase"

/** SA-5 `TensorOp` — reshape / concatenate / multiply / matmultiply /
 * transpose / permute. Uses the same flat `attributes` shape. */
export const TensorOp = makeNNLayerComponent("TensorOp", "TensorOp", "#FFF3E0")
