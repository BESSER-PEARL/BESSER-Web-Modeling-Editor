import { describe, it, expect } from 'vitest';
import type { UMLModel } from '@besser/wme';
import { aggregateProfilePersonalization } from '../personalization-aggregation';
// (co-located in shared/utils — consumed by both the generation and deploy features)

/**
 * Build a minimal UserDiagram model carrying personalization specs on the root
 * User box and/or an attribute, mirroring what buildUserDiagramModel emits.
 */
const modelWith = (opts: {
  userSpec?: any;
  ageSpec?: any;
}): UMLModel =>
  ({
    type: 'UserDiagram',
    elements: {
      u1: {
        id: 'u1',
        type: 'UserModelName',
        name: 'user_1',
        className: 'User',
        owner: null,
        attributes: [],
        ...(opts.userSpec ? { personalization: opts.userSpec } : {}),
      },
      pi1: {
        id: 'pi1',
        type: 'UserModelName',
        name: 'personal_Information_1',
        className: 'Personal_Information',
        owner: null,
        attributes: ['a1'],
      },
      a1: {
        id: 'a1',
        type: 'UserModelAttribute',
        name: 'age >= 18',
        owner: 'pi1',
        attributeId: 'a-pi-age',
        attributeOperator: '>=',
        ...(opts.ageSpec ? { personalization: opts.ageSpec } : {}),
      },
    },
    relationships: {
      r1: { id: 'r1', type: 'ObjectLink', source: { element: 'u1' }, target: { element: 'pi1' } },
    },
  }) as unknown as UMLModel;

describe('aggregateProfilePersonalization', () => {
  it('returns empty configuration and no specs when nothing is set', () => {
    const { configuration, specs } = aggregateProfilePersonalization(modelWith({}));
    expect(configuration).toEqual({});
    expect(specs).toHaveLength(0);
  });

  it('maps a profile-level spec onto the flat configuration (sparse)', () => {
    const { configuration, specs } = aggregateProfilePersonalization(
      modelWith({
        userSpec: {
          presentation: { size: 16, font: 'serif' },
          content: { languageComplexity: 'simple', useAbbreviations: true },
        },
      }),
    );
    expect(configuration.interfaceStyle).toEqual({ size: 16, font: 'serif' });
    expect(configuration.languageComplexity).toBe('simple');
    expect(configuration.useAbbreviations).toBe(true);
    // Sparse: nothing else set.
    expect(configuration.voiceStyle).toBeUndefined();
    expect(configuration.outputModalities).toBeUndefined();
    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({ source: 'profile', label: 'User' });
  });

  it('maps content language and style onto agentLanguage/agentStyle', () => {
    const { configuration } = aggregateProfilePersonalization(
      modelWith({
        userSpec: {
          content: { language: 'french', style: 'formal', languageComplexity: 'simple' },
        },
      }),
    );
    expect(configuration.agentLanguage).toBe('french');
    expect(configuration.agentStyle).toBe('formal');
    expect(configuration.languageComplexity).toBe('simple');
  });

  it('maps modality onto top-level modalities and voiceStyle', () => {
    const { configuration } = aggregateProfilePersonalization(
      modelWith({
        userSpec: {
          modality: {
            inputModalities: ['text'],
            outputModalities: ['voice', 'text'],
            voiceGender: 'female',
            voiceSpeed: 1.2,
          },
        },
      }),
    );
    expect(configuration.inputModalities).toEqual(['text']);
    expect(configuration.outputModalities).toEqual(['voice', 'text']);
    expect(configuration.voiceStyle).toEqual({ gender: 'female', speed: 1.2 });
  });

  it('lets an attribute spec win over the profile spec (attribute merged last)', () => {
    const { configuration, specs } = aggregateProfilePersonalization(
      modelWith({
        userSpec: { presentation: { size: 14, contrast: 'low' } },
        ageSpec: { presentation: { size: 22 } },
      }),
    );
    // size overridden by the attribute; contrast retained from the profile.
    expect(configuration.interfaceStyle).toEqual({ size: 22, contrast: 'low' });
    expect(specs.map((s) => s.source)).toEqual(['profile', 'attribute']);
    expect(specs[1].label).toBe('Personal_Information.age');
  });

  it('is null-safe', () => {
    expect(aggregateProfilePersonalization(null)).toEqual({ configuration: {}, specs: [] });
    expect(aggregateProfilePersonalization(undefined)).toEqual({ configuration: {}, specs: [] });
  });
});
