/**
 * LocalStorage migrator from v3 UMLModel shape (`elements` /
 * `relationships` records) to v4 shape (`nodes` / `edges` arrays).
 *
 * Wraps the per-diagram migrators exposed by `@besser/wme`. Dispatches by
 * the model's `type` field to the right migrator. Used by
 * `migrateProjectToV5` in `shared/types/project.ts`.
 */
import {
  migrateClassDiagramV3ToV4,
  migrateObjectDiagramV3ToV4,
  migrateStateMachineDiagramV3ToV4,
  migrateAgentDiagramV3ToV4,
  migrateUserDiagramV3ToV4,
  migrateNNDiagramV3ToV4,
  migrateBpmnDiagramV3ToV4,
  convertV3ToV4,
  isV3Format,
  isV4Format,
  normalizeV4Model,
  type UMLModel,
} from '@besser/wme';

export {
  migrateClassDiagramV3ToV4,
  migrateObjectDiagramV3ToV4,
  migrateStateMachineDiagramV3ToV4,
  migrateAgentDiagramV3ToV4,
  migrateUserDiagramV3ToV4,
  migrateNNDiagramV3ToV4,
  migrateBpmnDiagramV3ToV4,
};

type SupportedDiagramType =
  | 'ClassDiagram'
  | 'ObjectDiagram'
  | 'StateMachineDiagram'
  | 'AgentDiagram'
  | 'UserDiagram'
  | 'NNDiagram'
  | 'BPMN'
  // Non-UML kinds — skipped at the caller, but listed for the param's union.
  | 'GUINoCodeDiagram'
  | 'QuantumCircuitDiagram';

/**
 * Migrate a v3 UMLModel object to v4. The diagram type is taken from the
 * model's `type` field by default; pass `diagramType` to override (used by
 * the project-level migrator which knows the bucket the diagram lives in).
 *
 * Returns a fresh v4 model. Throws if the migration fails — callers should
 * wrap in try/catch and keep the v3 model on failure.
 */
/**
 * Normalize a UML model *snapshot* — one that bypasses the editor on its way
 * to persistence (agent base models in ``besser_agentBaseModels``, saved
 * configuration snapshots in ``besser_agentConfigs``, user-profile models in
 * ``besser_userProfiles``, inline ``config.personalizedVariants[].model``
 * entries, and bundled models in imported project envelopes).
 *
 * Every snapshot must be canonical v4 at rest:
 *  - v4 input → ``normalizeV4Model`` (idempotent canonicalization);
 *  - v3 input (develop-era exports / pre-migration localStorage) →
 *    ``convertV3ToV4`` then ``normalizeV4Model``, which lifts legacy flat
 *    agent transitions (top-level ``condition``/``conditionValue``) into the
 *    nested ``edge.data.transitionType`` + ``predefined``/``custom`` shape;
 *  - anything else passes through untouched (null-safe, mirrors the
 *    develop-branch ``normalizeAgentModel`` behavior).
 *
 * Pure: never mutates its input. Works for any UML diagram type — the v4
 * equivalent of develop's agent-only ``normalizeAgentModel``.
 */
export function normalizeUmlModelSnapshot<T>(model: T): T {
  if (!model || typeof model !== 'object') return model;
  if (isV4Format(model)) return normalizeV4Model(model) as T;
  if (isV3Format(model)) return normalizeV4Model(convertV3ToV4(model as any)) as T;
  return model;
}

export function migrateUMLModelV3ToV4(
  model: any,
  diagramType?: SupportedDiagramType,
): UMLModel {
  // Prefer caller-provided bucket type — it's the most reliable signal
  // because the wrapping ProjectDiagram knows which array the model lives in.
  // Fall back to the model's `type` field, which v3 models always carry.
  const type = diagramType ?? (model && typeof model === 'object' ? model.type : undefined);

  switch (type) {
    case 'ClassDiagram':
      return migrateClassDiagramV3ToV4(model);
    case 'ObjectDiagram':
      return migrateObjectDiagramV3ToV4(model);
    case 'StateMachineDiagram':
      return migrateStateMachineDiagramV3ToV4(model);
    case 'AgentDiagram':
      return migrateAgentDiagramV3ToV4(model);
    case 'UserDiagram':
      return migrateUserDiagramV3ToV4(model);
    case 'NNDiagram':
      return migrateNNDiagramV3ToV4(model);
    case 'BPMN':
      return migrateBpmnDiagramV3ToV4(model);
    default:
      throw new Error(
        `[migrateUMLModelV3ToV4] Unsupported diagram type: ${String(type)}`,
      );
  }
}
