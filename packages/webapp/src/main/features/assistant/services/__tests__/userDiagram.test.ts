/**
 * Assistant UserDiagram converter / modifier tests (v4-native).
 *
 * Profiles are `UserModelName` nodes whose criterion rows live inline on
 * `data.attributes` ({name, attributeOperator, value, attributeId?}); links
 * are `UserModelLink` edges.
 */

import { UserDiagramConverter } from '../converters/UserDiagramConverter';
import { UserDiagramModifier } from '../modifiers/UserDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';
import { isUMLModel } from '../../../../shared/types/project';

function makeEmptyModel(): BESSERModel {
  return {
    version: '4.0.0',
    id: '',
    title: '',
    type: 'UserDiagram',
    nodes: [],
    edges: [],
    assessments: {},
  } as any;
}

function byType(model: any, type: string): any[] {
  return ((model.nodes ?? []) as any[]).filter((n) => n.type === type);
}

function profileNode(id: string, name: string, className: string): any {
  return {
    id,
    type: 'UserModelName',
    position: { x: 0, y: 0 },
    width: 200,
    height: 50,
    measured: { width: 200, height: 50 },
    data: { name, className, attributes: [], methods: [] },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UserDiagramConverter
// ═══════════════════════════════════════════════════════════════════════════

describe('UserDiagramConverter', () => {
  const converter = new UserDiagramConverter();

  it('converts a complete system into UserModelName nodes with inline criterion rows', () => {
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
            { name: 'iso693_3', operator: '=', value: 'Spanish', attributeId: 'attr-iso' },
            { name: 'level', operator: '==', value: 'B2', attributeId: 'attr-level' },
          ],
        },
      ],
      links: [{ source: 'pi1', target: 'lang1', relationshipType: 'speaks' }],
    };

    const model: any = converter.convertCompleteSystem(systemSpec);

    expect(isUMLModel(model)).toBe(true);
    expect(model.version).toBe('4.0.0');
    expect(model.type).toBe('UserDiagram');
    expect(model.title).toBe('Teen Spanish speaker');
    expect(model).not.toHaveProperty('elements');

    const boxes = byType(model, 'UserModelName');
    expect(boxes).toHaveLength(2);
    // No separate attribute / icon nodes in v4.
    expect(byType(model, 'UserModelAttribute')).toHaveLength(0);
    expect(byType(model, 'UserModelIcon')).toHaveLength(0);

    const lang = boxes.find((b) => b.data.className === 'Language');
    expect(lang.data.classId).toBe('class-lang');
    expect(lang.data.name).toBe('lang1');
    expect(lang.data.view).toBe('icon');
    expect(lang.data.attributes).toHaveLength(2);
    expect(lang.height).toBe(50 + 2 * 30);

    const pi = boxes.find((b) => b.data.className === 'Personal_Information');
    const ageRow = pi.data.attributes.find((a: any) => a.attributeId === 'attr-age');
    expect(ageRow).toMatchObject({ name: 'age', attributeOperator: '>=', value: '13' });

    // A bare '=' normalises to the canonical '==' operator.
    const isoRow = lang.data.attributes.find((a: any) => a.attributeId === 'attr-iso');
    expect(isoRow).toMatchObject({ name: 'iso693_3', attributeOperator: '==', value: 'Spanish' });

    // Link wired as a UserModelLink between the two boxes.
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({ type: 'UserModelLink', source: pi.id, target: lang.id });
    expect(model.edges[0].data).toMatchObject({ name: 'speaks', label: 'speaks' });
  });

  it('stores the metamodel class icon inline on the node', () => {
    const model: any = converter.convertCompleteSystem({
      profiles: [{ profileName: 'u1', className: 'User', classId: 'c', icon: '<svg></svg>', attributes: [] }],
      links: [],
    });
    const box = byType(model, 'UserModelName')[0];
    expect(box.data.icon).toBe('<svg></svg>');
    expect(byType(model, 'UserModelIcon')).toHaveLength(0);
  });

  it('resolves links that reference profiles by class name and skips dangling ones', () => {
    const model: any = converter.convertCompleteSystem({
      profiles: [
        { profileName: 'user_1', className: 'User', attributes: [] },
        { profileName: 'pi1', className: 'Personal_Information', attributes: [] },
      ],
      links: [
        { source: 'User', target: 'Personal_Information' },
        { source: 'User', target: 'Missing' },
      ],
    });
    expect(model.edges).toHaveLength(1);
    const ids = new Set(model.nodes.map((n: any) => n.id));
    expect(ids.has(model.edges[0].source)).toBe(true);
    expect(ids.has(model.edges[0].target)).toBe(true);
  });

  it('convertSingleElement returns a one-node fragment', () => {
    const fragment = converter.convertSingleElement({
      profileName: 'lang1',
      className: 'Language',
      attributes: [{ name: 'level', operator: '>=', value: 'C1' }],
    });
    expect(fragment.edges).toEqual([]);
    expect(fragment.nodes).toHaveLength(1);
    expect(fragment.nodes[0]).toMatchObject({
      type: 'UserModelName',
      data: { name: 'lang1', className: 'Language' },
    });
    expect((fragment.nodes[0].data as any).attributes[0]).toMatchObject({
      name: 'level',
      attributeOperator: '>=',
      value: 'C1',
    });
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

  it('add_object creates a UserModelName node with operator-bearing rows', () => {
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

    const result: any = modifier.applyModification(model, mod);
    const boxes = byType(result, 'UserModelName');
    expect(boxes).toHaveLength(1);
    expect(boxes[0].data).toMatchObject({ name: 'language2', className: 'Language', classId: 'class-lang' });

    const rows = boxes[0].data.attributes;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'level', attributeOperator: '>=', value: 'C1', attributeId: 'attr-level' });
    expect(boxes[0].height).toBe(50 + 30);
  });

  it('add_object stores the icon inline when the change carries one', () => {
    const result: any = modifier.applyModification(makeEmptyModel(), {
      action: 'add_object',
      target: { profileName: 'disability1' },
      changes: {
        className: 'Disability',
        classId: 'class-dis',
        icon: '<svg></svg>',
        attributes: [{ name: 'name', operator: '==', value: 'Paraplegia' }],
      },
    } as ModelModification);

    const box = byType(result, 'UserModelName')[0];
    expect(box.data.icon).toBe('<svg></svg>');
    expect(box.data.view).toBe('icon');
    expect(byType(result, 'UserModelIcon')).toHaveLength(0);
  });

  it('modify_attribute_value updates operator and value on an existing row', () => {
    const built = modifier.applyModification(makeEmptyModel(), {
      action: 'add_object',
      target: { profileName: 'pi1' },
      changes: {
        className: 'Personal_Information',
        attributes: [{ name: 'age', operator: '==', value: '18' }],
      },
    } as ModelModification);

    const updated: any = modifier.applyModification(built, {
      action: 'modify_attribute_value',
      target: { profileName: 'pi1', attributeName: 'age' },
      changes: { operator: '>=', value: '21' },
    } as ModelModification);

    const row = byType(updated, 'UserModelName')[0].data.attributes[0];
    expect(row).toMatchObject({ name: 'age', attributeOperator: '>=', value: '21' });
  });

  it('modify_attribute_value normalises legacy fused row names', () => {
    const model: any = makeEmptyModel();
    const node = profileNode('u', 'pi1', 'Personal_Information');
    node.data.attributes = [{ id: 'r1', name: 'age >= 18', attributeOperator: '>=' }];
    model.nodes.push(node);

    const updated: any = modifier.applyModification(model, {
      action: 'modify_attribute_value',
      target: { className: 'Personal_Information', attributeName: 'age' },
      changes: { value: '30' },
    } as ModelModification);
    expect(updated.nodes[0].data.attributes[0]).toMatchObject({ name: 'age', attributeOperator: '>=', value: '30' });
  });

  it('modify_attribute_value throws for unknown profiles or rows', () => {
    const built = modifier.applyModification(makeEmptyModel(), {
      action: 'add_object',
      target: { profileName: 'pi1' },
      changes: { className: 'Personal_Information', attributes: [{ name: 'age', operator: '==', value: '18' }] },
    } as ModelModification);
    expect(() =>
      modifier.applyModification(built, {
        action: 'modify_attribute_value',
        target: { profileName: 'ghost', attributeName: 'age' },
        changes: { value: '1' },
      } as ModelModification),
    ).toThrow(/not found/);
    expect(() =>
      modifier.applyModification(built, {
        action: 'modify_attribute_value',
        target: { profileName: 'pi1', attributeName: 'height' },
        changes: { value: '1' },
      } as ModelModification),
    ).toThrow(/height/);
  });

  it('add_link connects two boxes with a UserModelLink', () => {
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

    const linked: any = modifier.applyModification(model, {
      action: 'add_link',
      target: { sourceProfile: 'user1', targetProfile: 'pi1' },
      changes: { relationshipType: 'has' },
    } as ModelModification);

    expect(linked.edges).toHaveLength(1);
    expect(linked.edges[0].type).toBe('UserModelLink');
    expect(linked.edges[0].data).toMatchObject({ name: 'has', label: 'has' });
    const boxes = byType(linked, 'UserModelName');
    expect(linked.edges[0].source).toBe(boxes[0].id);
    expect(linked.edges[0].target).toBe(boxes[1].id);
  });

  it('resolves className-referenced links (matches the backend structural expansion)', () => {
    // The backend emits add_object for a missing ancestor, then add_link mods
    // that reference singletons by className. Apply that exact sequence.
    let model: any = makeEmptyModel();
    model.nodes.push(profileNode('u', 'user_1', 'User'));

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
    expect(model.edges).toHaveLength(2);
    // Both links resolved to real node ids (no dangling references).
    const ids = new Set(model.nodes.map((n: any) => n.id));
    for (const e of model.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  it('modify_object renames a profile addressed by class name', () => {
    const model: any = makeEmptyModel();
    model.nodes.push(profileNode('u', 'user_1', 'User'));
    const result: any = modifier.applyModification(model, {
      action: 'modify_object',
      target: { className: 'User' },
      changes: { profileName: 'admin' },
    } as ModelModification);
    expect(result.nodes[0].data.name).toBe('admin');
  });

  it('remove_element deletes the box and its links; unknown targets are a no-op', () => {
    let model: any = makeEmptyModel();
    model = modifier.applyModification(model, {
      action: 'add_object',
      target: { profileName: 'lang1' },
      changes: { className: 'Language', attributes: [{ name: 'level', operator: '==', value: 'B2' }] },
    } as ModelModification);
    model = modifier.applyModification(model, {
      action: 'add_object',
      target: { profileName: 'user1' },
      changes: { className: 'User', attributes: [] },
    } as ModelModification);
    model = modifier.applyModification(model, {
      action: 'add_link',
      target: { sourceProfile: 'user1', targetProfile: 'lang1' },
      changes: {},
    } as ModelModification);
    expect(model.nodes).toHaveLength(2);
    expect(model.edges).toHaveLength(1);

    const removed: any = modifier.applyModification(model, {
      action: 'remove_element',
      target: { profileName: 'lang1' },
      changes: {},
    } as ModelModification);
    expect(removed.nodes).toHaveLength(1);
    expect(removed.edges).toHaveLength(0);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const untouched: any = modifier.applyModification(removed, {
      action: 'remove_element',
      target: { profileName: 'lang1' },
      changes: {},
    } as ModelModification);
    expect(untouched.nodes).toHaveLength(1);
    warn.mockRestore();
  });
});
