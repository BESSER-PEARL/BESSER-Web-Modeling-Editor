import type { BesserProject } from '../../types/project';
import { getActiveDiagram, getReferencedDiagram, isUMLModel } from '../../types/project';

/**
 * Attach the linked ClassDiagram model as `model.referenceDiagramData` when
 * validating an ObjectDiagram.
 *
 * The backend's /validate-diagram endpoint rejects ObjectDiagram payloads
 * that don't carry their reference class diagram ("Object diagram requires
 * reference class diagram data"). The Apollon editor used to inject this in
 * its model getter via the diagram bridge; the React Flow editor knows
 * nothing about the project, so the webapp resolves the reference here —
 * per-diagram `references` by ID first, `currentDiagramIndices` as fallback
 * (the exact resolution code generation and export already use).
 *
 * UserDiagram validation does NOT need this: the backend validates user
 * models against its preset `user_reference_domain_model`.
 *
 * Returns the model untouched for every other diagram type, when the model
 * already carries `referenceDiagramData`, or when no class diagram can be
 * resolved (the backend then reports the missing reference). Never mutates
 * the input model.
 */
export function withReferenceDiagramData(
  model: Record<string, any>,
  project: BesserProject | null | undefined,
): Record<string, any> {
  if (!model || model.type !== 'ObjectDiagram' || model.referenceDiagramData) {
    return model;
  }
  if (!project) {
    return model;
  }

  const activeObjectDiagram = getActiveDiagram(project, 'ObjectDiagram');
  const classDiagram = getReferencedDiagram(project, activeObjectDiagram, 'ClassDiagram');
  if (classDiagram?.model && isUMLModel(classDiagram.model)) {
    return { ...model, referenceDiagramData: classDiagram.model };
  }

  return model;
}
