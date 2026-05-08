/**
 * SA-7b: localStorage migrator from v3 UMLModel shape (`elements` /
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
  type UMLModel,
} from '@besser/wme';

export {
  migrateClassDiagramV3ToV4,
  migrateObjectDiagramV3ToV4,
  migrateStateMachineDiagramV3ToV4,
  migrateAgentDiagramV3ToV4,
  migrateUserDiagramV3ToV4,
  migrateNNDiagramV3ToV4,
};

type SupportedDiagramType =
  | 'ClassDiagram'
  | 'ObjectDiagram'
  | 'StateMachineDiagram'
  | 'AgentDiagram'
  | 'UserDiagram'
  | 'NNDiagram'
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
    default:
      throw new Error(
        `[migrateUMLModelV3ToV4] Unsupported diagram type: ${String(type)}`,
      );
  }
}
