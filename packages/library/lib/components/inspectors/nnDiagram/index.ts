/**
 * SA-5 NNDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 * Registers the panel-editor bodies against the central inspector
 * registry from SA-1 (`registry.ts`).
 *
 * Per the SA-5 brief: ONE generic `NNComponentEditPanel` adapts to any
 * layer kind by reading the per-kind field schema from
 * `nnAttributeWidgetConfig`. Configuration / TensorOp / Datasets all
 * resolve their fields the same way and share the generic body.
 *
 * NNContainer and NNReference get dedicated panels because they edit
 * structural fields (entry layer pointer, reference target) that don't
 * fit the flat `attributes` shape.
 */
import { registerInspector } from "../registry"
import { NNComponentEditPanel } from "./NNComponentEditPanel"
import { NNContainerEditPanel } from "./NNContainerEditPanel"
import { NNReferenceEditPanel } from "./NNReferenceEditPanel"

const LAYER_KINDS = [
  "Conv1DLayer",
  "Conv2DLayer",
  "Conv3DLayer",
  "PoolingLayer",
  "RNNLayer",
  "LSTMLayer",
  "GRULayer",
  "LinearLayer",
  "FlattenLayer",
  "EmbeddingLayer",
  "DropoutLayer",
  "LayerNormalizationLayer",
  "BatchNormalizationLayer",
  "TensorOp",
  "Configuration",
  "TrainingDataset",
  "TestDataset",
] as const

for (const kind of LAYER_KINDS) {
  registerInspector(kind, "edit", NNComponentEditPanel)
}

registerInspector("NNContainer", "edit", NNContainerEditPanel)
registerInspector("NNReference", "edit", NNReferenceEditPanel)

export * from "./NNComponentEditPanel"
export * from "./NNContainerEditPanel"
export * from "./NNReferenceEditPanel"
