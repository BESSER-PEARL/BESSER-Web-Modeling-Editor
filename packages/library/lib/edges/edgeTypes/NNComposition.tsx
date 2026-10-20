import { NNNext } from "./NNNext"
import { registerEdgeTypes } from "../types"

/**
 * `NNComposition` edge — diamond on the source (NNContainer)
 * side, indicating ownership of the layer. Visual differs from
 * `NNNext` only in the marker, which is sourced from
 * `getEdgeMarkerStyles('NNComposition')` (`url(#black-rhombus)` on
 * markerStart). The renderer logic is identical to `NNNext`, so this
 * file aliases the component and registers a separate edge type.
 */
export const NNComposition = NNNext

// Side-effect: extend the edge-type registry.
registerEdgeTypes({ NNComposition })
