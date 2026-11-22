import { UMLModel } from '../typings';
import { UMLModelCompat } from './typings';
import { isV2, v2ModeltoV3Model } from './v2';
import { normalizeModelAssociationNavigability } from '../packages/common/uml-association/uml-association-navigability';

/**
 *
 * Converts a model to the latest version.
 *
 * @param {UMLModelCompat} model model to convert
 * @returns {UMLModel} the converted model
 *
 */
export function backwardsCompatibleModel(model: UMLModelCompat): UMLModel {
  const latest = isV2(model) ? v2ModeltoV3Model(model) : model;
  // Class-diagram associations: the legacy `ClassUnidirectional` type becomes a
  // `ClassBidirectional` with per-end `navigable` flags, and missing flags are
  // filled in from the legacy defaults.
  return normalizeModelAssociationNavigability(latest);
}

export type { UMLModelCompat } from './typings';
export * from './helpers';
