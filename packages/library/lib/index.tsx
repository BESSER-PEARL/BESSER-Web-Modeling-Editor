export * from "./typings"
export * from "./besser-editor"
export * from "./utils/helpers"
export * from "./utils/versionConverter"
export * from "./utils"
export { layoutModel, getAutoLayoutStrategies } from "./utils/autoLayout"
export type { AutoLayoutOptions, AutoLayoutStrategy } from "./utils/autoLayout"
export {
  normalizeAgentModel,
  normalizeAgentTransitionData,
  normalizeAgentBodyRow,
} from "./utils/normalizeAgentModel"
export {
  REPLY_TYPE_TO_ACTION_TYPE,
  ACTION_TYPE_TO_REPLY_TYPE,
  resolveReplyType,
  withActionType,
  NEW_TRANSITION_PREDEFINED_TYPE,
} from "./utils/agentActions"
// Off-canvas agent components (v4 `model.components`): type names, entry
// type and the legacy-location migrator (canvas nodes / agentComponents →
// components). Used by the webapp's agent Components page and assistant.
export {
  AgentComponentType,
  AGENT_COMPONENT_TYPES,
  isAgentComponentType,
  normalizeAgentComponents,
  getAgentComponentsOfType,
} from "./utils/agentComponents"
export type { AgentComponents } from "./utils/agentComponents"
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
  AgentGUIInfo,
  AgentIntentInfo,
  AgentLLMInfo,
  AgentRAGInfo,
} from "./services/diagramBridge"

// Agent LLM provider catalogue (AgentConfigurationPanel.tsx,
// local-storage-repository.ts).
export {
  AGENT_LLM_PROVIDERS,
  LEGACY_AGENT_LLM_PROVIDER_ALIASES,
  ACCEPTED_AGENT_LLM_PROVIDERS,
  NON_CHAT_AGENT_LLM_PROVIDERS,
  isAcceptedAgentLLMProvider,
  canonicalizeAgentLLMProvider,
} from "./services/agentLlm"
export type {
  AgentLLMProviderType,
  LegacyAgentLLMProviderType,
} from "./services/agentLlm"

// BPMN flow rules (bpmn-xml-importer.ts / bpmn-xml-exporter.ts, assistant).
export {
  BPMN_FLOW_EDGE_TYPES,
  bpmnEdgeTypeToFlowType,
  bpmnFlowTypeToEdgeType,
  isBpmnFlowEdge,
  getAllowedBpmnFlowTypes,
  getDefaultBpmnFlowType,
  canSourceCarryDefault,
  validateBpmnFlow,
  validateAllBpmnFlows,
} from "./services/bpmnFlowValidation"
export type {
  BpmnFlowType,
  DefaultFlowSource,
  BPMNFlowValidationCode,
  BPMNFlowValidationWarning,
} from "./services/bpmnFlowValidation"

// Agentic BPMN: lane / task / gateway attribute vocabulary, XML extension
// namespace, collaboration-block walkers and the Governance DSL generator.
export * from "./types/bpmnAgentic"
export {
  resolveUpstreamDivergingGateway,
  findDownstreamAgenticConstructs,
  findOrphanedMergingGateways,
  generateGovernanceDsl,
  GOV_POLICY_TYPES,
} from "./services/bpmnCollaborationBlocks"
export type { GovPolicyType } from "./services/bpmnCollaborationBlocks"

// Agentic Component-diagram stereotype vocabulary (mirrors BESSER
// `uml_component/agentic.py`).
export * from "./utils/agenticTokens"

// Host providers registered through the BesserEditor setters
// (setLineageProvider / setElementPickerProvider / setAgentDiagramLinker).
export type {
  LineageProvider,
  ResolvedSource,
  ElementPickerProvider,
  PickableElement,
  AgentDiagramLinker,
} from "./components/hostProviders/contexts"

// Inspector controls backed by those providers, the preset text field, the
// agentic canvas glyphs and the edge-midpoint label anchor.
export * from "./components/inspectors/shared"
export * from "./components/svgs/icons/agentic"
export * from "./utils/relationshipMidpoint"

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

// Canvas-control glyphs and the bar's overlay offset, for the webapp's
// Cytoscape (Knowledge Graph) canvas so its controls bar matches the editor's.
export { UndoIcon } from "./components/Icon/UndoIcon"
export { RedoIcon } from "./components/Icon/RedoIcon"
export { AutoLayoutIcon } from "./components/Icon/AutoLayoutIcon"
export { FitViewIcon, ZoomInIcon, ZoomOutIcon } from "./components/Icon/ZoomIcons"
export { usePublishControlsRight } from "./hooks/usePublishControlsRight"

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
