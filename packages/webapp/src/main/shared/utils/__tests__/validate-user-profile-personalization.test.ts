import { describe, it, expect } from 'vitest';
import { collectPersonalizationConflicts } from '../validate-user-profile-personalization';

// ---------------------------------------------------------------------------
// Helpers to build minimal model fixtures
// ---------------------------------------------------------------------------

const BASE_MODEL = { version: '3.0.0', size: { width: 1400, height: 740 }, interactive: { elements: {}, relationships: {} }, assessments: {} };

function makeAttr(id: string, name: string, personalization?: object) {
  return { id, type: 'UserModelAttribute', name, ...(personalization ? { personalization } : {}) };
}

function makeBox(id: string, className: string, attrs: string[], personalization?: object) {
  return { id, type: 'UserModelName', className, name: `${className.toLowerCase()}Instance`, attributes: attrs, ...(personalization ? { personalization } : {}) };
}

function makeLink(id: string, sourceId: string, targetId: string) {
  return { id, type: 'UserModelLink', source: { element: sourceId }, target: { element: targetId } };
}

function buildModel(elements: Record<string, object>, relationships: Record<string, object> = {}) {
  return { ...BASE_MODEL, type: 'UserDiagram', elements, relationships };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('collectPersonalizationConflicts', () => {
  it('returns [] for non-UserDiagram models', () => {
    const model = buildModel({}) as any;
    model.type = 'ClassDiagram';
    expect(collectPersonalizationConflicts(model)).toEqual([]);
  });

  it('returns [] when there are no personalization specs at all', () => {
    const user = makeBox('u1', 'User', ['a1']);
    const attr = makeAttr('a1', 'name = Alice');
    const model = buildModel({ u1: user, a1: attr }) as any;
    expect(collectPersonalizationConflicts(model)).toEqual([]);
  });

  it('returns [] when only one element has a spec', () => {
    const user = makeBox('u1', 'User', [], { content: { language: 'french' } });
    const lang = makeBox('l1', 'Language', []);
    const model = buildModel({ u1: user, l1: lang }, { r1: makeLink('r1', 'u1', 'l1') }) as any;
    expect(collectPersonalizationConflicts(model)).toEqual([]);
  });

  it('returns [] when two elements set the same field to the same value', () => {
    const user = makeBox('u1', 'User', [], { content: { language: 'french' } });
    const lang = makeBox('l1', 'Language', [], { content: { language: 'french' } });
    const model = buildModel({ u1: user, l1: lang }, { r1: makeLink('r1', 'u1', 'l1') }) as any;
    expect(collectPersonalizationConflicts(model)).toEqual([]);
  });

  it('reports a conflict when two boxes in the same profile set the same field to different values', () => {
    const user = makeBox('u1', 'User', [], { content: { language: 'french' } });
    const lang = makeBox('l1', 'Language', [], { content: { language: 'german' } });
    const model = buildModel({ u1: user, l1: lang }, { r1: makeLink('r1', 'u1', 'l1') }) as any;
    const errors = collectPersonalizationConflicts(model);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/language/i);
    expect(errors[0]).toMatch(/french/);
    expect(errors[0]).toMatch(/german/);
  });

  it('reports a conflict between root user spec and a connected box spec', () => {
    const user = makeBox('u1', 'User', [], { presentation: { font: 'serif' } });
    const skill = makeBox('s1', 'Skill', [], { presentation: { font: 'sans' } });
    const model = buildModel({ u1: user, s1: skill }, { r1: makeLink('r1', 'u1', 's1') }) as any;
    const errors = collectPersonalizationConflicts(model);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/font/i);
  });

  it('does NOT flag fields set by only one source even if other fields conflict', () => {
    // language conflicts, but size is only set in one spec
    const user = makeBox('u1', 'User', [], { content: { language: 'french' }, presentation: { size: 14 } });
    const lang = makeBox('l1', 'Language', [], { content: { language: 'german' } });
    const model = buildModel({ u1: user, l1: lang }, { r1: makeLink('r1', 'u1', 'l1') }) as any;
    const errors = collectPersonalizationConflicts(model);
    expect(errors).toHaveLength(1); // only language conflicts
    expect(errors[0]).toMatch(/language/i);
  });

  it('handles legacy attribute-level specs (different attribute specs conflict)', () => {
    const user = makeBox('u1', 'User', []);
    const attr1 = makeAttr('a1', 'iso693_3 = fr', { content: { language: 'french' } });
    const attr2 = makeAttr('a2', 'level = B2', { content: { language: 'german' } });
    const lang = makeBox('l1', 'Language', ['a1', 'a2']);
    const model = buildModel({ u1: user, l1: lang, a1: attr1, a2: attr2 }, { r1: makeLink('r1', 'u1', 'l1') }) as any;
    const errors = collectPersonalizationConflicts(model);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/language/i);
  });

  it('does not report a conflict between profiles on the same canvas (different User roots)', () => {
    // Two independent profiles, each sets language to a different value — that is fine
    const user1 = makeBox('u1', 'User', [], { content: { language: 'french' } });
    const user2 = makeBox('u2', 'User', [], { content: { language: 'german' } });
    const model = buildModel({ u1: user1, u2: user2 }) as any;
    expect(collectPersonalizationConflicts(model)).toEqual([]);
  });

  it('reports separate conflict messages per affected profile', () => {
    const user1 = makeBox('u1', 'User', ['n1'], { content: { language: 'french' } });
    const nameAttr1 = makeAttr('n1', 'name = Alice');
    const lang1 = makeBox('l1', 'Language', [], { content: { language: 'german' } });

    const user2 = makeBox('u2', 'User', ['n2'], { content: { language: 'english' } });
    const nameAttr2 = makeAttr('n2', 'name = Bob');
    const lang2 = makeBox('l2', 'Language', [], { content: { language: 'spanish' } });

    const model = buildModel(
      { u1: user1, n1: nameAttr1, l1: lang1, u2: user2, n2: nameAttr2, l2: lang2 },
      { r1: makeLink('r1', 'u1', 'l1'), r2: makeLink('r2', 'u2', 'l2') },
    ) as any;

    const errors = collectPersonalizationConflicts(model);
    expect(errors).toHaveLength(2);
  });

  it('normalises array modality values order-independently', () => {
    const user = makeBox('u1', 'User', [], { modality: { inputModalities: ['text', 'speech'] } });
    const lang = makeBox('l1', 'Language', [], { modality: { inputModalities: ['speech', 'text'] } });
    const model = buildModel({ u1: user, l1: lang }, { r1: makeLink('r1', 'u1', 'l1') }) as any;
    // Same set of modalities in different order → no conflict
    expect(collectPersonalizationConflicts(model)).toEqual([]);
  });

  it('reports a conflict when array modality values differ', () => {
    const user = makeBox('u1', 'User', [], { modality: { inputModalities: ['text'] } });
    const lang = makeBox('l1', 'Language', [], { modality: { inputModalities: ['speech'] } });
    const model = buildModel({ u1: user, l1: lang }, { r1: makeLink('r1', 'u1', 'l1') }) as any;
    const errors = collectPersonalizationConflicts(model);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/inputModalities/i);
  });
});
