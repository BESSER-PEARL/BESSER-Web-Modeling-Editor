/**
 * SA-2 / SA-2.1 ClassDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 * Registers panel-editor bodies against the central inspector registry
 * (see SA-1 `registry.ts`); both `PropertiesPanel` and `PopoverManager`
 * resolve their bodies from that registry.
 *
 * SA-2: `ClassEditPanel` for `class` nodes.
 * SA-2.1: `ClassEdgeEditPanel` for the nine ClassDiagram edge types.
 */
import { registerInspector } from "../registry"
import { ClassEdgeEditPanel } from "./ClassEdgeEditPanel"

const CLASS_EDGE_TYPES = [
  "ClassInheritance",
  "ClassRealization",
  "ClassComposition",
  "ClassAggregation",
  "ClassUnidirectional",
  "ClassBidirectional",
  "ClassDependency",
  // SA-2.1: BESSER-specific edge types restored alongside the dropped
  // v3 entries in `lib/edges/types.tsx` and `versionConverter.ts`.
  "ClassOCLLink",
  "ClassLinkRel",
] as const

for (const type of CLASS_EDGE_TYPES) {
  registerInspector(type, "edit", ClassEdgeEditPanel)
}

export * from "./ClassEditPanel"
export * from "./ClassEdgeEditPanel"
