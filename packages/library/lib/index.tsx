export * from "./typings"
export * from "./besser-editor"
export * from "./utils/helpers"
export * from "./utils/versionConverter"
export * from "./utils"
export { log, setLogLevel, setLogger } from "./logger"
export type { LogLevel } from "./logger"

// diagramBridge singleton + types (4 webapp call sites: DiagramTabs.tsx,
// BesserEditorComponent.tsx, workspaceSlice.ts, useImportDiagram.ts).
export { diagramBridge, DiagramBridgeService } from "./services/diagramBridge"
export type {
  IClassDiagramData,
  IClassInfo,
  IAttributeInfo,
  IAssociationInfo,
  IDiagramReference,
  IDiagramBridgeService,
} from "./services/diagramBridge"

// settingsService + ClassNotation (used by ProjectSettingsPanel.tsx).
export {
  settingsService,
  SettingsService,
  DEFAULT_SETTINGS,
} from "./services/settingsService"
export type {
  ClassNotation,
  IApplicationSettings,
  ISettingsService,
} from "./services/settingsService"

// Multiplicity helpers (used by features/editors/uml/__tests__/multiplicity.test.ts).
// Already covered by `export * from "./utils"` via `./utils/index.ts`, but
// `./utils/multiplicity.ts` is not in that barrel, so re-export explicitly.
export {
  parseMultiplicity,
  toERCardinality,
  erCardinalityToUML,
} from "./utils/multiplicity"

// Type-normalisation + display helpers (informational re-exports — not
// in the 14 webapp-imported symbols today, but kept aligned with the
// List so future webapp call sites can pick them up).
export {
  TYPE_ALIASES,
  normalizeType,
  VISIBILITY_SYMBOLS,
  SYMBOL_TO_VISIBILITY,
} from "./utils/typeNormalization"
export type { Visibility } from "./utils/typeNormalization"
export {
  parseLegacyNameFormat,
  formatDisplayName,
  formatObjectMember,
} from "./utils/classifierMemberDisplay"
export type { ClassifierMemberLike } from "./utils/classifierMemberDisplay"

// Re-export the user-modelling reference metamodel as a JSON
// import so the webapp can `import { userMetaModel } from '@besser/wme'`.
// Backend remains the OCL validation authority — this is shipped purely
// for the frontend's reference / tooling.
import userMetaModelJson from "./services/userMetaModel/usermetamodel.json"
export const userMetaModel = userMetaModelJson

// V4-shape converter + class-list helper for the user
// meta-model. The webapp uses `getUserMetaModelV4()` when seeding the
// `diagramBridge` (so enum lookups in `UserModelNameEditPanel` work),
// and the library palette walks `getUserMetaModelClasses()` to produce
// per-class drag-sources (replicating v3's `composeUserModelPreview`).
export {
  getUserMetaModelClasses,
  getUserMetaModelV4,
} from "./services/userMetaModel"
export type { UserMetaModelClass } from "./services/userMetaModel"
