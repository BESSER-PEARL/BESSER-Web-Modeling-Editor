/**
 * SA-4 `UserModelLink` edge — re-export of SA-2's `ObjectDiagramEdge`
 * registered under a dedicated edge type. Per the SA-4 brief, the user
 * model is a special case of object diagram with semantic constraints,
 * so the edge visual is identical to `ObjectLink` — the difference is
 * purely the type discriminator the backend OCL validator uses.
 *
 * Side-effect registration extends `_edgeTypeRegistry` so the editor
 * resolves `<ReactFlow edges={[{ type: 'UserModelLink', … }]} />` to
 * the same renderer.
 */
import { ObjectDiagramEdge } from "./ObjectDiagramEdge"
import { registerEdgeTypes } from "../types"

export const UserModelLink = ObjectDiagramEdge

// Side-effect: extend the edge-type registry.
registerEdgeTypes({ UserModelLink })
