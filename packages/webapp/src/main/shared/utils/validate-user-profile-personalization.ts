/**
 * Frontend-side validation of personalization conflict rules within a UserDiagram.
 *
 * A "personalization conflict" occurs when two elements within the SAME user
 * profile set the same personalization field to DIFFERENT values. Same-value
 * repetition is fine; different values are not (the generator would need to
 * pick one and silently discard the other).
 *
 * Sources that are checked per profile:
 *   - The root `User` box's personalization spec (profile-level)
 *   - Every connected box's personalization spec (box-level)
 *   - Every attribute element inside those boxes (attribute-level, legacy)
 *
 * Array fields (inputModalities, outputModalities) are compared as sorted,
 * comma-joined strings so that `['text','speech']` and `['speech','text']`
 * are treated as equal.
 */

import type { UMLModel, UserPersonalizationSpec } from '@besser/wme';
import { isPersonalizationSpecEmpty, isUserPersonalizationSpec } from '@besser/wme';
import { splitUserDiagramIntoProfiles } from './user-profile-graph';

const ROOT_CLASS_NAME = 'User';

type FieldPath = string;
type NormalizedValue = string;

interface SourceSetting {
  /** Human-readable element label, e.g. "Language" or "Language.level". */
  source: string;
  value: NormalizedValue;
}

/** Extract every set leaf field from a spec into a `path → normalizedValue` map. */
function extractLeafFields(spec: UserPersonalizationSpec): Map<FieldPath, NormalizedValue> {
  const fields = new Map<FieldPath, NormalizedValue>();
  const set = (path: FieldPath, v: unknown) =>
    fields.set(path, Array.isArray(v) ? [...v].sort().join(',') : String(v));

  const { presentation, modality, content } = spec;

  if (presentation) {
    if (presentation.size !== undefined) set('presentation.size', presentation.size);
    if (presentation.font !== undefined) set('presentation.font', presentation.font);
    if (presentation.lineSpacing !== undefined) set('presentation.lineSpacing', presentation.lineSpacing);
    if (presentation.alignment !== undefined) set('presentation.alignment', presentation.alignment);
    if (presentation.color !== undefined && presentation.color !== '') set('presentation.color', presentation.color);
    if (presentation.contrast !== undefined) set('presentation.contrast', presentation.contrast);
    if (presentation.language !== undefined) set('presentation.language', presentation.language);
    if (presentation.style !== undefined) set('presentation.style', presentation.style);
    if (presentation.languageComplexity !== undefined) set('presentation.languageComplexity', presentation.languageComplexity);
    if (presentation.sentenceLength !== undefined) set('presentation.sentenceLength', presentation.sentenceLength);
    if (presentation.useAbbreviations !== undefined) set('presentation.useAbbreviations', presentation.useAbbreviations);
  }

  if (modality) {
    if (modality.inputModalities?.length) set('modality.inputModalities', modality.inputModalities);
    if (modality.outputModalities?.length) set('modality.outputModalities', modality.outputModalities);
    if (modality.voiceGender !== undefined) set('modality.voiceGender', modality.voiceGender);
    if (modality.voiceSpeed !== undefined) set('modality.voiceSpeed', modality.voiceSpeed);
  }

  if (content) {
    if (content.adaptContentToUserProfile !== undefined)
      set('content.adaptContentToUserProfile', content.adaptContentToUserProfile);
  }

  return fields;
}

interface SpecEntry {
  label: string;
  fields: Map<FieldPath, NormalizedValue>;
}

/** Collect every non-empty personalization spec in a single-profile sub-model. */
function collectSpecsFromProfile(subModel: UMLModel): SpecEntry[] {
  const elements = (subModel.elements || {}) as Record<string, any>;
  const entries: SpecEntry[] = [];

  const boxes = Object.values(elements).filter((el: any) => el?.type === 'UserModelName');

  for (const box of boxes) {
    const isRoot = box.className === ROOT_CLASS_NAME;
    const boxLabel: string = isRoot
      ? 'User (profile level)'
      : box.displayLabel || box.className || box.name || 'element';

    if (isUserPersonalizationSpec(box.personalization) && !isPersonalizationSpecEmpty(box.personalization)) {
      entries.push({ label: boxLabel, fields: extractLeafFields(box.personalization as UserPersonalizationSpec) });
    }

    // Legacy: attribute-level specs written before the UI moved personalization
    // to the box level are still present on individual UserModelAttribute rows.
    const attrIds: string[] = Array.isArray(box.attributes) ? box.attributes : [];
    for (const attrId of attrIds) {
      const attr = elements[attrId];
      if (!attr || attr.type !== 'UserModelAttribute') continue;
      if (!isUserPersonalizationSpec(attr.personalization) || isPersonalizationSpecEmpty(attr.personalization)) continue;
      const attrName = String(attr.name || '').split(/[<>=]/)[0].trim() || attrId;
      entries.push({
        label: `${boxLabel}.${attrName}`,
        fields: extractLeafFields(attr.personalization as UserPersonalizationSpec),
      });
    }
  }

  return entries;
}

/** Make a field path human-readable in error messages. */
function friendlyField(path: FieldPath): string {
  // e.g. "content.language" → "language (content)"
  const [dim, field] = path.split('.');
  return field ? `${field} (${dim})` : path;
}

/**
 * Check a `UserDiagram` model for personalization conflicts and return one
 * error string per conflict. An empty array means no conflicts.
 *
 * A conflict: within a single profile, two sources set the same field to
 * different values. Same value from multiple sources is acceptable.
 */
export function collectPersonalizationConflicts(model: UMLModel | null | undefined): string[] {
  if (!model || (model as any).type !== 'UserDiagram') return [];

  const profiles = splitUserDiagramIntoProfiles(model);
  const errors: string[] = [];

  for (const profile of profiles) {
    const profileName = profile.name ? `"${profile.name}"` : 'unnamed profile';
    const specEntries = collectSpecsFromProfile(profile.model);

    if (specEntries.length < 2) continue;

    // Bucket each (source, value) pair by field path.
    const byField = new Map<FieldPath, SourceSetting[]>();
    for (const { label, fields } of specEntries) {
      for (const [path, value] of fields) {
        if (!byField.has(path)) byField.set(path, []);
        byField.get(path)!.push({ source: label, value });
      }
    }

    // A field is conflicted when two sources have different normalized values.
    for (const [path, settings] of byField) {
      if (settings.length < 2) continue;
      const first = settings[0].value;
      const allSame = settings.every((s) => s.value === first);
      if (allSame) continue;

      const details = settings.map((s) => `"${s.source}" → ${s.value}`).join(', ');
      errors.push(
        `Personalization conflict in profile ${profileName}: field "${friendlyField(path)}" has incompatible values: ${details}.`,
      );
    }
  }

  return errors;
}
