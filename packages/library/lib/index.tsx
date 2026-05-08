export * from "./typings"
export * from "./apollon-editor"
export * from "./utils/helpers"
export * from "./utils/versionConverter"
export * from "./utils"
export { log, setLogLevel, setLogger } from "./logger"
export type { LogLevel } from "./logger"

// SA-7a: re-export the OLD-ONLY symbols the v2 webapp depends on so that
// flipping the `@besser/wme` alias in the webapp can be done without
// touching call sites. See `docs/source/migrations/api-surface-diff.md`
// for the full inventory; the additions below close the diff identified
// by SA-API-DIFF.

// diagramBridge singleton + types (4 webapp call sites: DiagramTabs.tsx,
// ApollonEditorComponent.tsx, workspaceSlice.ts, useImportDiagram.ts).
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
// SA-API-DIFF P0 list so future webapp call sites can pick them up).
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
} from "./utils/classifierMemberDisplay"
export type { ClassifierMemberLike } from "./utils/classifierMemberDisplay"

// SA-4: re-export the user-modelling reference metamodel as a JSON
// import so the webapp can `import { userMetaModel } from '@besser/wme'`.
// Backend remains the OCL validation authority — this is shipped purely
// for the frontend's reference / tooling.
import userMetaModelJson from "./services/userMetaModel/usermetamodel.json"
export const userMetaModel = userMetaModelJson
