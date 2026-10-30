/**
 * ClassDiagram inspector registrations.
 *
 * Imported as a side-effect from `lib/components/inspectors/index.ts`.
 * Registers panel-editor bodies against the central inspector registry
 * (`registry.ts`); both `PropertiesPanel` and `PopoverManager`
 * resolve their bodies from that registry.
 *
 * `ClassEditPanel` for `class` nodes.
 * `ClassEdgeEditPanel` for the nine ClassDiagram edge types.
 */
import { registerInspector } from "../registry"
import { ClassEdgeEditPanel } from "./ClassEdgeEditPanel"
import { ClassOCLConstraintEditPanel } from "./ClassOCLConstraintEditPanel"

const CLASS_EDGE_TYPES = [
  "ClassInheritance",
  "ClassRealization",
  "ClassComposition",
  "ClassAggregation",
  "ClassUnidirectional",
  "ClassBidirectional",
  "ClassDependency",
  // BESSER-specific edge types restored alongside the dropped
  // v3 entries in `lib/edges/types.tsx` and `versionConverter.ts`.
  "ClassOCLLink",
  "ClassLinkRel",
] as const

for (const type of CLASS_EDGE_TYPES) {
  registerInspector(type, "edit", ClassEdgeEditPanel)
}

// Free-standing OCL constraint node — separate inspector
// body (minimal: name, kind, expression, description). Owned constraints
// are still edited via the OCL section inside `ClassEditPanel`.
registerInspector("ClassOCLConstraint", "edit", ClassOCLConstraintEditPanel)

export * from "./ClassEditPanel"
export * from "./ClassEdgeEditPanel"
export * from "./ClassOCLConstraintEditPanel"
