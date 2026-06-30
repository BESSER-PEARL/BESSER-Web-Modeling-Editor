import { UserDiagramConverter } from '../converters/UserDiagramConverter';
import { UserDiagramModifier } from '../modifiers/UserDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

function makeEmptyModel(): BESSERModel {
  return {
    version: '3.0.0',
    type: 'UserDiagram',
    size: { width: 1000, height: 800 },
    elements: {},
    relationships: {},
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  };
}

function byType(model: any, type: string) {
  return Object.values(model.elements).filter((el: any) => el.type === type);
}

// ═══════════════════════════════════════════════════════════════════════════
// UserDiagramConverter
// ═══════════════════════════════════════════════════════════════════════════

describe('UserDiagramConverter', () => {
  const converter = new UserDiagramConverter();

  it('converts a complete system into UserModelName + UserModelAttribute elements', () => {
    const systemSpec = {
      systemName: 'Teen Spanish speaker',
      profiles: [
        {
          profileName: 'pi1',
          className: 'Personal_Information',
          classId: 'class-pi',
          attributes: [{ name: 'age', operator: '>=', value: '13', attributeId: 'attr-age' }],
        },
        {
          profileName: 'lang1',
          className: 'Language',
          classId: 'class-lang',
          attributes: [
            { name: 'iso693_3', operator: '==', value: 'Spanish', attributeId: 'attr-iso' },
            { name: 'level', operator: '==', value: 'B2', attributeId: 'attr-level' },
          ],
        },
      ],
      links: [{ source: 'pi1', target: 'lang1', relationshipType: 'speaks' }],
    };

    const model: any = converter.convertCompleteSystem(systemSpec);

    expect(model.type).toBe('UserDiagram');
    const boxes = byType(model, 'UserModelName');
    expect(boxes).toHaveLength(2);

    const lang: any = boxes.find((b: any) => b.className === 'Language');
    expect(lang.classId).toBe('class-lang');
    expect(lang.attributes).toHaveLength(2);

    const attrs = byType(model, 'UserModelAttribute');
    const ageRow: any = attrs.find((a: any) => a.attributeId === 'attr-age');
    expect(ageRow.name).toBe('age >= 13');
    expect(ageRow.attributeOperator).toBe('>=');

    const isoRow: any = attrs.find((a: any) => a.attributeId === 'attr-iso');
    // Equality renders with a single '='.
    expect(isoRow.name).toBe('iso693_3 = Spanish');
    expect(isoRow.attributeOperator).toBe('==');

    // Link wired as an ObjectLink between the two boxes.
    const links = Object.values(model.relationships);
    expect(links).toHaveLength(1);
    expect((links[0] as any).type).toBe('ObjectLink');
  });

  it('creates a UserModelIcon child when an icon is provided', () => {
    const model: any = converter.convertCompleteSystem({
      profiles: [
        { profileName: 'u1', className: 'User', classId: 'c', icon: '<svg></svg>', attributes: [] },
      ],
      links: [],
    });
    const icons = byType(model, 'UserModelIcon');
    expect(icons).toHaveLength(1);
    const box: any = byType(model, 'UserModelName')[0];
    expect(box.icon).toBe((icons[0] as any).id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UserDiagramModifier
// ═══════════════════════════════════════════════════════════════════════════

describe('UserDiagramModifier', () => {
  const modifier = new UserDiagramModifier();

  it('canHandle reuses the object-diagram action vocabulary', () => {
    for (const a of ['add_object', 'modify_object', 'modify_attribute_value', 'add_link', 'remove_element']) {
      expect(modifier.canHandle(a)).toBe(true);
    }
    expect(modifier.canHandle('add_class')).toBe(false);
  });

  it('add_object creates a UserModelName box with operator-bearing rows', () => {
    const model = makeEmptyModel();
    const mod: ModelModification = {
      action: 'add_object',
      target: { profileName: 'language2' },
      changes: {
        className: 'Language',
        classId: 'class-lang',
        attributes: [{ name: 'level', operator: '>=', value: 'C1', attributeId: 'attr-level' }],
      },
    };

    const result = modifier.applyModification(model, mod);
    const boxes = byType(result, 'UserModelName');
    expect(boxes).toHaveLength(1);
    expect((boxes[0] as any).className).toBe('Language');

    const rows = byType(result, 'UserModelAttribute');
    expect(rows).toHaveLength(1);
    expect((rows[0] as any).name).toBe('level >= C1');
    expect((rows[0] as any).attributeOperator).toBe('>=');
  });

  it('modify_attribute_value updates operator and value on an existing row', () => {
    const model = makeEmptyModel();
    const built = modifier.applyModification(model, {
      action: 'add_object',
      target: { profileName: 'pi1' },
      changes: {
        className: 'Personal_Information',
        attributes: [{ name: 'age', operator: '==', value: '18' }],
      },
    } as ModelModification);

    const updated = modifier.applyModification(built, {
      action: 'modify_attribute_value',
      target: { profileName: 'pi1', attributeName: 'age' },
      changes: { operator: '>=', value: '21' },
    } as ModelModification);

    const row: any = byType(updated, 'UserModelAttribute')[0];
    expect(row.name).toBe('age >= 21');
    expect(row.attributeOperator).toBe('>=');
  });

  it('add_link connects two boxes with an ObjectLink', () => {
    let model = makeEmptyModel();
    model = modifier.applyModification(model, {
      action: 'add_object',
      target: { profileName: 'user1' },
      changes: { className: 'User', attributes: [] },
    } as ModelModification);
    model = modifier.applyModification(model, {
      action: 'add_object',
      target: { profileName: 'pi1' },
      changes: { className: 'Personal_Information', attributes: [] },
    } as ModelModification);

    const linked = modifier.applyModification(model, {
      action: 'add_link',
      target: { sourceProfile: 'user1', targetProfile: 'pi1' },
      changes: { relationshipType: 'has' },
    } as ModelModification);

    const rels = Object.values(linked.relationships);
    expect(rels).toHaveLength(1);
    expect((rels[0] as any).type).toBe('ObjectLink');
  });

  it('resolves className-referenced links (matches the backend structural expansion)', () => {
    // The backend emits add_object for a missing ancestor, then add_link mods
    // that reference singletons by className. Apply that exact sequence.
    let model = makeEmptyModel();
    model.elements['u'] = {
      type: 'UserModelName', id: 'u', name: 'user_1', className: 'User',
      owner: null, bounds: { x: 0, y: 0, width: 200, height: 50 }, attributes: [], methods: [],
    } as any;

    const seq: ModelModification[] = [
      { action: 'add_object', target: { profileName: 'accessibility' },
        changes: { className: 'Accessibility', attributes: [] } } as any,
      { action: 'add_object', target: { profileName: 'disability1' },
        changes: { className: 'Disability',
                   attributes: [{ name: 'name', operator: '==', value: 'Paraplegia' }] } } as any,
      { action: 'add_link', target: { sourceProfile: 'User', targetProfile: 'Accessibility' },
        changes: { source: 'User', target: 'Accessibility', relationshipType: '' } } as any,
      { action: 'add_link', target: { sourceProfile: 'Accessibility', targetProfile: 'disability1' },
        changes: { source: 'Accessibility', target: 'disability1', relationshipType: '' } } as any,
    ];
    for (const mod of seq) {
      model = modifier.applyModification(model, mod);
    }

    expect(byType(model, 'UserModelName')).toHaveLength(3);
    const rels = Object.values(model.relationships);
    expect(rels).toHaveLength(2);
    // Both links resolved to real element ids (no dangling references).
    const ids = new Set(Object.keys(model.elements));
    for (const r of rels as any[]) {
      expect(ids.has(r.source.element)).toBe(true);
      expect(ids.has(r.target.element)).toBe(true);
    }
  });

  it('remove_element deletes the box and its attribute children', () => {
    let model = makeEmptyModel();
    model = modifier.applyModification(model, {
      action: 'add_object',
      target: { profileName: 'lang1' },
      changes: {
        className: 'Language',
        attributes: [{ name: 'level', operator: '==', value: 'B2' }],
      },
    } as ModelModification);
    expect(Object.keys(model.elements)).toHaveLength(2);

    const removed = modifier.applyModification(model, {
      action: 'remove_element',
      target: { profileName: 'lang1' },
      changes: {},
    } as ModelModification);
    expect(Object.keys(removed.elements)).toHaveLength(0);
  });
});
