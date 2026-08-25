/**
 * Collapses the per-element personalization specs authored on a `UserDiagram`
 * into a single flat `AgentConfigurationPayload` fragment for generation/deploy.
 *
 * A user profile carries personalization specs on its elements — at the profile
 * level (root `User` box) and at the attribute level (each criterion row). The
 * backend's generation `configuration` is still one flat, profile-level object,
 * so this walks the model and merges every spec into that shape.
 *
 * Merge order (last wins): defaults → root `User` spec → other box specs →
 * attribute specs, all in document order. Attribute-level detail therefore wins
 * over profile-level, matching "the most specific spec applies". The mapped
 * `configuration` is **sparse** — only keys that some spec actually set appear,
 * so callers can merge it onto their own defaults without clobbering.
 *
 * `specs` preserves the lossless per-source list (which element set what) so the
 * full per-attribute detail is still available inline in the shipped
 * `user_profile` model even though the flat `configuration` collapses it.
 */

import type { UMLModel, UserPersonalizationSpec } from '@besser/wme';
import { isPersonalizationSpecEmpty, isUserPersonalizationSpec } from '@besser/wme';
import type { AgentConfigurationPayload } from '../types/agent-config';

/** Root class name of the user metamodel — the profile-level element. */
const ROOT_CLASS_NAME = 'User';

/** Nested objects are collapsed independently, so allow partial style objects. */
export type AggregatedConfiguration = Partial<
  Omit<AgentConfigurationPayload, 'interfaceStyle' | 'voiceStyle'>
> & {
  interfaceStyle?: Partial<AgentConfigurationPayload['interfaceStyle']>;
  voiceStyle?: Partial<AgentConfigurationPayload['voiceStyle']>;
};

export type PersonalizationSource = 'profile' | 'box' | 'attribute';

export interface PersonalizationSpecEntry {
  source: PersonalizationSource;
  /** Human-readable origin: the box class name, or `class.attribute` for a criterion. */
  label: string;
  spec: UserPersonalizationSpec;
}

export interface AggregatedPersonalization {
  configuration: AggregatedConfiguration;
  specs: PersonalizationSpecEntry[];
}

/** Fold one spec's set fields onto the accumulating sparse configuration (last wins). */
const applySpec = (config: AggregatedConfiguration, spec: UserPersonalizationSpec): void => {
  const { presentation, modality, content } = spec;

  if (presentation) {
    const style: Partial<AgentConfigurationPayload['interfaceStyle']> = { ...config.interfaceStyle };
    if (presentation.size !== undefined) style.size = presentation.size;
    if (presentation.font !== undefined) style.font = presentation.font;
    if (presentation.lineSpacing !== undefined) style.lineSpacing = presentation.lineSpacing;
    if (presentation.alignment !== undefined) style.alignment = presentation.alignment;
    if (presentation.color !== undefined && presentation.color !== '') style.color = presentation.color;
    if (presentation.contrast !== undefined) style.contrast = presentation.contrast;
    if (Object.keys(style).length) config.interfaceStyle = style;
  }

  if (modality) {
    if (modality.inputModalities && modality.inputModalities.length) {
      config.inputModalities = [...modality.inputModalities];
    }
    if (modality.outputModalities && modality.outputModalities.length) {
      config.outputModalities = [...modality.outputModalities];
    }
    if (modality.voiceGender !== undefined || modality.voiceSpeed !== undefined) {
      const voice: Partial<AgentConfigurationPayload['voiceStyle']> = { ...config.voiceStyle };
      if (modality.voiceGender !== undefined) voice.gender = modality.voiceGender;
      if (modality.voiceSpeed !== undefined) voice.speed = modality.voiceSpeed;
      if (Object.keys(voice).length) config.voiceStyle = voice;
    }
  }

  if (content) {
    if (content.language !== undefined) config.agentLanguage = content.language;
    if (content.style !== undefined) config.agentStyle = content.style;
    if (content.languageComplexity !== undefined) config.languageComplexity = content.languageComplexity;
    if (content.sentenceLength !== undefined) config.sentenceLength = content.sentenceLength;
    if (content.useAbbreviations !== undefined) config.useAbbreviations = content.useAbbreviations;
    if (content.adaptContentToUserProfile !== undefined) {
      config.adaptContentToUserProfile = content.adaptContentToUserProfile;
    }
  }
};

/**
 * Walk a `UserDiagram` model and aggregate every element personalization spec
 * into a sparse flat configuration plus a lossless per-source list.
 */
export const aggregateProfilePersonalization = (
  model: UMLModel | null | undefined,
): AggregatedPersonalization => {
  const configuration: AggregatedConfiguration = {};
  const specs: PersonalizationSpecEntry[] = [];

  const elements = (model?.elements || {}) as Record<string, any>;
  const boxes = Object.values(elements).filter((el: any) => el?.type === 'UserModelName');

  // Root User box first (profile-level spec), then remaining boxes in element
  // order, then all attribute specs in each box's document order. Ordering the
  // fold this way makes attribute specs win over box specs, and any box spec
  // win over the root profile spec.
  const rootBox = boxes.find((el: any) => el.className === ROOT_CLASS_NAME);
  const otherBoxes = boxes.filter((el: any) => el !== rootBox);
  const orderedBoxes = rootBox ? [rootBox, ...otherBoxes] : otherBoxes;

  const attributeEntries: PersonalizationSpecEntry[] = [];

  for (const box of orderedBoxes) {
    const className: string = box.className || box.name || 'element';

    if (isUserPersonalizationSpec(box.personalization) && !isPersonalizationSpecEmpty(box.personalization)) {
      specs.push({
        source: box === rootBox ? 'profile' : 'box',
        label: className,
        spec: box.personalization as UserPersonalizationSpec,
      });
    }

    const attrIds: string[] = Array.isArray(box.attributes) ? box.attributes : [];
    for (const attrId of attrIds) {
      const attrEl = elements[attrId];
      if (!attrEl || attrEl.type !== 'UserModelAttribute') continue;
      if (isUserPersonalizationSpec(attrEl.personalization) && !isPersonalizationSpecEmpty(attrEl.personalization)) {
        const attrName = String(attrEl.name || '').split(/[<>=]/)[0].trim() || attrId;
        attributeEntries.push({
          source: 'attribute',
          label: `${className}.${attrName}`,
          spec: attrEl.personalization as UserPersonalizationSpec,
        });
      }
    }
  }

  specs.push(...attributeEntries);

  // Fold box specs first (root profile → other boxes), attribute specs last.
  for (const entry of specs) {
    applySpec(configuration, entry.spec);
  }

  return { configuration, specs };
};
