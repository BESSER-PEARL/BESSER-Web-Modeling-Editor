/**
 * SA-3 StateMachineDiagram node-type registrations.
 *
 * Importing this barrel as a side-effect (from `lib/nodes/index.ts`)
 * extends the central `_nodeTypeRegistry` in `nodes/types.ts` with the
 * 11 BESSER state-machine node types.
 *
 * Palette registrations live in a sibling module (`./palette.ts`)
 * because the palette config touches `constants.ts` which is part of
 * a transitive cycle with `@/utils/nodeUtils`. The palette barrel is
 * imported as a side-effect only from `App.tsx` (mirrors how
 * `components/inspectors/index.ts` is imported), so the round-trip
 * test path — which loads `versionConverter.ts` only — never triggers
 * the palette init.
 *
 * Node-type keys follow the spec at
 * `docs/source/migrations/uml-v4-shape.md` (StateMachineDiagram §):
 * `State`, `StateBody`, `StateFallbackBody`, `StateActionNode`,
 * `StateObjectNode`, `StateInitialNode`, `StateFinalNode`,
 * `StateMergeNode`, `StateForkNode`, `StateForkNodeHorizontal`,
 * `StateCodeBlock`. PascalCase matches the v3 element-type strings so
 * the migrator passes them through verbatim.
 */
import { registerNodeTypes } from "../types"
import { State } from "./State"
import { StateBody } from "./StateBody"
import { StateFallbackBody } from "./StateFallbackBody"
import { StateCodeBlock } from "./StateCodeBlock"
import { StateActionNode } from "./StateActionNode"
import { StateObjectNode } from "./StateObjectNode"
import { StateInitialNode } from "./StateInitialNode"
import { StateFinalNode } from "./StateFinalNode"
import { StateMergeNode } from "./StateMergeNode"
import { StateForkNode } from "./StateForkNode"
import { StateForkNodeHorizontal } from "./StateForkNodeHorizontal"

registerNodeTypes({
  State,
  StateBody,
  StateFallbackBody,
  StateCodeBlock,
  StateActionNode,
  StateObjectNode,
  StateInitialNode,
  StateFinalNode,
  StateMergeNode,
  StateForkNode,
  StateForkNodeHorizontal,
})

export * from "./State"
export * from "./StateBody"
export * from "./StateFallbackBody"
export * from "./StateCodeBlock"
export * from "./StateActionNode"
export * from "./StateObjectNode"
export * from "./StateInitialNode"
export * from "./StateFinalNode"
export * from "./StateMergeNode"
export * from "./StateForkNode"
export * from "./StateForkNodeHorizontal"
