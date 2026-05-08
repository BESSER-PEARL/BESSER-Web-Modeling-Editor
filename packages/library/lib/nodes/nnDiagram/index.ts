/**
 * SA-5 NNDiagram node-type registrations.
 *
 * Importing this barrel as a side-effect (from `lib/nodes/index.ts`)
 * extends the central `_nodeTypeRegistry` in `nodes/types.ts` with the
 * 18 BESSER NN-diagram node types per the spec at
 * `docs/source/migrations/uml-v4-shape.md` (NNDiagram §). The biggest
 * architectural change vs. v3: per-attribute UMLElements collapse onto
 * `node.data.attributes: Record<string, unknown>`. Backend already
 * collapsed these in SA-6.1's `nn_diagram_processor.py`; this is the
 * matching frontend shape.
 *
 * Parent/child contract:
 *  - Layer nodes use `parentId = NNContainer.id` to nest inside a
 *    container, mirroring SA-3's State/StateBody pattern.
 *  - `TrainingDataset` / `TestDataset` / `Configuration` / `TensorOp` /
 *    `NNReference` are top-level nodes (no parentId by default).
 */
import { registerNodeTypes } from "../types"
import { Conv1DLayer } from "./Conv1DLayer"
import { Conv2DLayer } from "./Conv2DLayer"
import { Conv3DLayer } from "./Conv3DLayer"
import { PoolingLayer } from "./PoolingLayer"
import { RNNLayer } from "./RNNLayer"
import { LSTMLayer } from "./LSTMLayer"
import { GRULayer } from "./GRULayer"
import { LinearLayer } from "./LinearLayer"
import { FlattenLayer } from "./FlattenLayer"
import { EmbeddingLayer } from "./EmbeddingLayer"
import { DropoutLayer } from "./DropoutLayer"
import { LayerNormalizationLayer } from "./LayerNormalizationLayer"
import { BatchNormalizationLayer } from "./BatchNormalizationLayer"
import { TensorOp } from "./TensorOp"
import { Configuration } from "./Configuration"
import { TrainingDataset } from "./TrainingDataset"
import { TestDataset } from "./TestDataset"
import { NNContainer } from "./NNContainer"
import { NNReference } from "./NNReference"

registerNodeTypes({
  Conv1DLayer,
  Conv2DLayer,
  Conv3DLayer,
  PoolingLayer,
  RNNLayer,
  LSTMLayer,
  GRULayer,
  LinearLayer,
  FlattenLayer,
  EmbeddingLayer,
  DropoutLayer,
  LayerNormalizationLayer,
  BatchNormalizationLayer,
  TensorOp,
  Configuration,
  TrainingDataset,
  TestDataset,
  NNContainer,
  NNReference,
})

export * from "./Conv1DLayer"
export * from "./Conv2DLayer"
export * from "./Conv3DLayer"
export * from "./PoolingLayer"
export * from "./RNNLayer"
export * from "./LSTMLayer"
export * from "./GRULayer"
export * from "./LinearLayer"
export * from "./FlattenLayer"
export * from "./EmbeddingLayer"
export * from "./DropoutLayer"
export * from "./LayerNormalizationLayer"
export * from "./BatchNormalizationLayer"
export * from "./TensorOp"
export * from "./Configuration"
export * from "./TrainingDataset"
export * from "./TestDataset"
export * from "./NNContainer"
export * from "./NNReference"
export * from "./nnAttributeWidgetConfig"
export * from "./nnValidationDefaults"
