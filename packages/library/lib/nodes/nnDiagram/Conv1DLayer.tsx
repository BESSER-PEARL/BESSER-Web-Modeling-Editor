import { makeNNLayerComponent } from "./_NNLayerBase"

/**
 * SA-5 `Conv1DLayer`. v3 source:
 * `packages/editor/src/main/packages/nn-diagram/nn-conv1d-layer/`. The
 * v3 layer card carried a per-attribute child UMLElement for every
 * Conv1D-specific attribute; SA-5 collapses those onto
 * `node.data.attributes` and renders the card as a labelled rounded
 * rectangle. Per-attribute rendering happens in the inspector panel.
 */
export const Conv1DLayer = makeNNLayerComponent("Conv1DLayer", "Conv1D", "#FFF8E1")
