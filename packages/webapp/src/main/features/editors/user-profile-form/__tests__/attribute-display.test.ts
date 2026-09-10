import { describe, it, expect } from 'vitest';
import { convertV3ToV4 } from '@besser/wme';
import type { UMLModel } from '@besser/wme';
import { buildUserDiagramModel, createEmptyInstance, parseUserDiagramModel } from '../model-serialization';
import type { MetaTree } from '../metamodel-tree';

/**
 * Regression guard for the criterion display: a `UserModelAttribute` row must
 * survive save -> reload verbatim. Before the v4 migration the row was
 * rendered through the generic classifier-member formatter and, once
 * `attributeType` defaulted to `str`, showed up as `+ age = 25: str`.
 * In v4 the criterion lives inline on the `UserModelName` node with the bare
 * name, comparator and value in their own fields; the migrator keeps a
 * legacy embedded criterion (`age = 25`) untouched and only lifts its
 * comparator.
 */

const tree: MetaTree = (() => {
  const personal = {
    className: 'Personal_Information',
    classId: 'c-pi',
    attributes: [{ id: 'a-pi-age', name: 'age', type: 'int' }],
    children: [],
  };
  const user = {
    className: 'User',
    classId: 'c-user',
    attributes: [],
    children: [{ className: 'Personal_Information', classId: 'c-pi', multiplicity: 'single' as const }],
  };
  return { root: user, byClassName: { User: user, Personal_Information: personal } };
})();

describe('UserModelAttribute display + round-trip', () => {
  it('keeps a legacy criterion verbatim when lifted to v4 (no visibility symbol / : type suffix)', () => {
    const v3 = {
      version: '3.0.0',
      type: 'UserDiagram',
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      assessments: {},
      elements: {
        pi1: {
          id: 'pi1',
          type: 'UserModelName',
          name: 'personal_Information_1',
          className: 'Personal_Information',
          owner: null,
          bounds: { x: 0, y: 0, width: 200, height: 80 },
          attributes: ['a1'],
          methods: [],
        },
        a1: {
          id: 'a1',
          type: 'UserModelAttribute',
          name: 'age = 25',
          owner: 'pi1',
          bounds: { x: 1, y: 40, width: 198, height: 30 },
          attributeId: 'a-pi-age',
          attributeOperator: '>=',
          // Written by the editor on save; must never leak into the display.
          visibility: 'public',
          attributeType: 'str',
        },
      },
      relationships: {},
    };

    const v4 = convertV3ToV4(v3 as any);
    const box = v4.nodes.find((n) => (n.type as string) === 'UserModelName') as any;
    expect(box).toBeDefined();
    const row = box.data.attributes.find((r: any) => r.id === 'a1');
    expect(row.name).toBe('age = 25');
    expect(row.name.startsWith('+')).toBe(false);
    expect(row.name.endsWith(': str')).toBe(false);
    // The explicit comparator wins over the one embedded in the name.
    expect(row.attributeOperator).toBe('>=');
    expect(row.attributeId).toBe('a-pi-age');
  });

  it('parses a legacy embedded criterion and re-emits it as structured name / operator / value', () => {
    const model = {
      version: '4.0.0',
      id: 'd1',
      title: 'profile',
      type: 'UserDiagram',
      nodes: [
        {
          id: 'u1',
          type: 'UserModelName',
          position: { x: 0, y: 0 },
          width: 200,
          height: 50,
          data: { name: 'user_1', className: 'User', attributes: [] },
        },
        {
          id: 'pi1',
          type: 'UserModelName',
          position: { x: 0, y: 200 },
          width: 200,
          height: 80,
          data: {
            name: 'personal_Information_1',
            className: 'Personal_Information',
            attributes: [
              { id: 'a1', name: 'age = 25', attributeId: 'a-pi-age', attributeOperator: '>=', attributeType: 'str' },
            ],
          },
        },
      ],
      edges: [{ id: 'l1', type: 'UserModelLink', source: 'u1', target: 'pi1', data: {} }],
      assessments: {},
    } as unknown as UMLModel;

    const parsed = parseUserDiagramModel(model, tree);
    const age = parsed?.children.Personal_Information?.[0].attributes.find((a) => a.name === 'age');
    expect(age?.operator).toBe('>=');
    expect(age?.value).toBe('25');

    const rebuilt = buildUserDiagramModel(parsed, tree) as any;
    const rebuiltRow = rebuilt.nodes
      .flatMap((n: any) => n.data.attributes as any[])
      .find((r: any) => r.attributeId === 'a-pi-age');
    // Structured form: bare name + comparator + value; the canvas composes "age >= 25".
    expect(rebuiltRow.name).toBe('age');
    expect(rebuiltRow.attributeOperator).toBe('>=');
    expect(rebuiltRow.value).toBe('25');
    expect(rebuiltRow.attributeType).toBe('int');
  });

  it('does not emit a value for unset fields, so the canvas shows the bare attribute', () => {
    const root = createEmptyInstance(tree.root!);
    root.children.Personal_Information = [createEmptyInstance(tree.byClassName.Personal_Information)];
    const model = buildUserDiagramModel(root, tree) as any;
    const row = model.nodes
      .flatMap((n: any) => n.data.attributes as any[])
      .find((r: any) => r.attributeId === 'a-pi-age');
    expect(row.name).toBe('age');
    expect('value' in row).toBe(false);
  });
});
