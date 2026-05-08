import { NNNext } from "./NNNext"
import { registerEdgeTypes } from "../types"

/**
 * SA-5 `NNAssociation` edge — plain undirected line connecting a
 * Dataset (`TrainingDataset` / `TestDataset`) to an `NNContainer`.
 * Shares the renderer with `NNNext`; the marker styles
 * (`getEdgeMarkerStyles('NNAssociation')`) explicitly omit any
 * marker so the line stays plain. Registered as its own edge type so
 * `<ReactFlow edges={[{ type: 'NNAssociation', … }]} />` resolves.
 */
export const NNAssociation = NNNext

// Side-effect: extend the edge-type registry.
registerEdgeTypes({ NNAssociation })
