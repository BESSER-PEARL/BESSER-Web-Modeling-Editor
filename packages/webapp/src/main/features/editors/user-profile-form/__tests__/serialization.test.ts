import { describe, it, expect, beforeAll } from 'vitest';
import { diagramBridge, getUserMetaModelV4 } from '@besser/wme';
import type { UMLModel } from '@besser/wme';
import { buildMetamodelTree, MetaTree } from '../metamodel-tree';
import {
  buildUserDiagramModel,
  parseUserDiagramModel,
  createEmptyInstance,
  instanceSignature,
  USER_LINK_TYPE,
  USER_NODE_TYPE,
} from '../model-serialization';
import { Instance } from '../types';

/* ------------------------------------------------------------------ */
/*  A small synthetic metamodel tree (independent of the bridge)       */
/* ------------------------------------------------------------------ */

const syntheticTree: MetaTree = (() => {
  const disability = {
    className: 'Disability',
    classId: 'c-dis',
    attributes: [
      { id: 'a-dis-name', name: 'name', type: 'str' },
      { id: 'a-dis-affects', name: 'affects', type: 'str' },
    ],
    children: [],
  };
  const accessibility = {
    className: 'Accessibility',
    classId: 'c-acc',
    attributes: [],
    children: [{ className: 'Disability', classId: 'c-dis', multiplicity: 'multiple' as const }],
  };
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
    children: [
      { className: 'Personal_Information', classId: 'c-pi', multiplicity: 'single' as const },
      { className: 'Accessibility', classId: 'c-acc', multiplicity: 'single' as const },
    ],
  };
  return {
    root: user,
    byClassName: { User: user, Personal_Information: personal, Accessibility: accessibility, Disability: disability },
  };
})();

const buildSampleProfile = (tree: MetaTree): Instance => {
  const root = createEmptyInstance(tree.root!);

  // Personal_Information with age >= 18
  const pi = createEmptyInstance(tree.byClassName.Personal_Information);
  pi.attributes[0].operator = '>=';
  pi.attributes[0].value = '18';
  root.children.Personal_Information = [pi];

  // Accessibility with two disabilities
  const acc = createEmptyInstance(tree.byClassName.Accessibility);
  const d1 = createEmptyInstance(tree.byClassName.Disability);
  d1.attributes[0].value = 'Low vision'; // name ==
  d1.attributes[1].value = 'vision'; // affects ==
  const d2 = createEmptyInstance(tree.byClassName.Disability);
  d2.attributes[0].value = 'Hearing loss';
  acc.children.Disability = [d1, d2];
  root.children.Accessibility = [acc];

  return root;
};

const boxesOf = (model: any) => (model.nodes as any[]).filter((n) => n.type === USER_NODE_TYPE);
const rowsOf = (model: any) => boxesOf(model).flatMap((n) => n.data.attributes as any[]);

describe('user-profile-form serialization', () => {
  it('builds a v4 UserDiagram model with the expected boxes, criteria and links', () => {
    const root = buildSampleProfile(syntheticTree);
    const model = buildUserDiagramModel(root, syntheticTree) as any;

    expect(model.version).toBe('4.0.0');
    expect(model.type).toBe('UserDiagram');
    expect(Array.isArray(model.nodes)).toBe(true);
    expect(Array.isArray(model.edges)).toBe(true);

    const boxes = boxesOf(model);
    const rows = rowsOf(model);
    const links = model.edges as any[];

    // User + Personal_Information + Accessibility + 2 Disabilities = 5 boxes
    expect(boxes).toHaveLength(5);
    // Every box is a UserModelName node (criteria live inline, no separate attribute nodes).
    expect(model.nodes).toHaveLength(5);
    // Links: PI, Accessibility, 2 Disabilities = 4 (User is the root, no inbound link)
    expect(links).toHaveLength(4);
    // Every metamodel attribute becomes a row: PI.age(1) + d1(name,affects) + d2(name,affects) = 5
    expect(rows).toHaveLength(5);

    const ageRow = rows.find((r) => r.name === 'age');
    expect(ageRow.attributeOperator).toBe('>=');
    expect(ageRow.value).toBe('18');
    expect(ageRow.attributeId).toBe('a-pi-age');
    expect(ageRow.attributeType).toBe('int');

    // className / classId / icon view are preserved on every box
    expect(boxes.every((b) => typeof b.data.className === 'string')).toBe(true);
    expect(boxes.every((b) => typeof b.data.classId === 'string')).toBe(true);
    expect(boxes.every((b) => b.data.view === 'icon')).toBe(true);
    expect(boxes.every((b) => typeof b.position?.x === 'number' && typeof b.width === 'number')).toBe(true);

    // Links are UserModelLink edges from the container to the part
    expect(links.every((l) => l.type === USER_LINK_TYPE)).toBe(true);
    const userBox = boxes.find((b) => b.data.className === 'User');
    const piBox = boxes.find((b) => b.data.className === 'Personal_Information');
    expect(links.some((l) => l.source === userBox.id && l.target === piBox.id)).toBe(true);
  });

  it('round-trips form state through the model (build -> parse) preserving structure and criteria', () => {
    const original = buildSampleProfile(syntheticTree);
    const model = buildUserDiagramModel(original, syntheticTree);
    const parsed = parseUserDiagramModel(model, syntheticTree);

    expect(instanceSignature(parsed)).toBe(instanceSignature(original));
  });

  it('emits every metamodel attribute as a row even when unset (for manual editing on the canvas)', () => {
    const root = createEmptyInstance(syntheticTree.root!);
    const acc = createEmptyInstance(syntheticTree.byClassName.Accessibility);
    // A disability with no values entered in the form.
    acc.children.Disability = [createEmptyInstance(syntheticTree.byClassName.Disability)];
    root.children.Accessibility = [acc];

    const model = buildUserDiagramModel(root, syntheticTree) as any;
    const boxes = boxesOf(model);
    const rows = rowsOf(model);

    expect(boxes).toHaveLength(3); // User + Accessibility + Disability
    // Disability has 2 metamodel attributes; both appear as rows though unset.
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name).sort()).toEqual(['affects', 'name']);
    expect(rows.every((r) => !('value' in r))).toBe(true);

    const parsed = parseUserDiagramModel(model, syntheticTree);
    expect(parsed?.children.Accessibility?.[0].children.Disability).toHaveLength(1);
  });

  it('reuses the existing canvas layout for boxes it can match', () => {
    const root = buildSampleProfile(syntheticTree);
    const first = buildUserDiagramModel(root, syntheticTree) as any;
    const piBox = boxesOf(first).find((b) => b.data.className === 'Personal_Information');
    piBox.position = { x: 1234, y: 567 };
    piBox.width = 320;

    const second = buildUserDiagramModel(root, syntheticTree, first) as any;
    const piAgain = boxesOf(second).find((b) => b.data.className === 'Personal_Information');
    expect(piAgain.position).toEqual({ x: 1234, y: 567 });
    expect(piAgain.width).toBe(320);
    // Model identity carried over from the existing diagram.
    expect(second.id).toBe(first.id);
  });

  it('parses values from an editor-serialized v4 model (manually-created shape) without loss', () => {
    // Mimics what the editor stores for a hand-built model: boxes carry
    // className, criterion rows carry a bare name plus comparator / value and
    // the editor's own visibility/attributeType metadata (which parse ignores).
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
          data: { name: 'user_1', className: 'User', attributes: [], methods: [] },
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
              {
                id: 'a1',
                name: 'age',
                attributeId: 'a-pi-age',
                attributeOperator: '>=',
                value: 30,
                visibility: 'public',
                attributeType: 'str',
              },
            ],
            methods: [],
          },
        },
      ],
      edges: [{ id: 'r1', type: 'UserModelLink', source: 'u1', target: 'pi1', data: {} }],
      assessments: {},
    } as unknown as UMLModel;

    const parsed = parseUserDiagramModel(model, syntheticTree);
    const pi = parsed?.children.Personal_Information?.[0];
    const age = pi?.attributes.find((a) => a.name === 'age');
    expect(age?.value).toBe('30');
    expect(age?.operator).toBe('>=');

    // Re-building from the parsed state keeps the value (no emptying on write-back).
    const rebuilt = buildUserDiagramModel(parsed, syntheticTree) as any;
    const ageRow = rowsOf(rebuilt).find((r) => r.name === 'age');
    expect(ageRow.attributeOperator).toBe('>=');
    expect(ageRow.value).toBe('30');
  });

  it('lifts a legacy v3 payload (separate UserModelAttribute children) before parsing', () => {
    const legacy = {
      version: '3.0.0',
      type: 'UserDiagram',
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      assessments: {},
      elements: {
        u1: {
          id: 'u1',
          type: 'UserModelName',
          name: 'user_1',
          className: 'User',
          owner: null,
          bounds: { x: 0, y: 0, width: 200, height: 50 },
          attributes: [],
          methods: [],
        },
        pi1: {
          id: 'pi1',
          type: 'UserModelName',
          name: 'personal_Information_1',
          className: 'Personal_Information',
          owner: null,
          bounds: { x: 0, y: 200, width: 200, height: 80 },
          attributes: ['a1'],
          methods: [],
        },
        a1: {
          id: 'a1',
          type: 'UserModelAttribute',
          name: 'age >= 30',
          owner: 'pi1',
          bounds: { x: 1, y: 240, width: 198, height: 30 },
          attributeId: 'a-pi-age',
          attributeOperator: '>=',
          visibility: 'public',
          attributeType: 'str',
        },
      },
      relationships: {
        r1: {
          id: 'r1',
          type: 'ObjectLink',
          name: '',
          bounds: { x: 0, y: 0, width: 0, height: 0 },
          path: [],
          source: { element: 'u1', direction: 'Right', bounds: { x: 0, y: 0, width: 0, height: 0 } },
          target: { element: 'pi1', direction: 'Left', bounds: { x: 0, y: 0, width: 0, height: 0 } },
        },
      },
    } as unknown as UMLModel;

    const parsed = parseUserDiagramModel(legacy, syntheticTree);
    const age = parsed?.children.Personal_Information?.[0]?.attributes.find((a) => a.name === 'age');
    expect(age?.value).toBe('30');
    expect(age?.operator).toBe('>=');
  });

  it('returns an empty root when the model has no nodes', () => {
    const parsed = parseUserDiagramModel(
      {
        version: '4.0.0',
        id: '',
        title: '',
        type: 'UserDiagram',
        nodes: [],
        edges: [],
        assessments: {},
      } as unknown as UMLModel,
      syntheticTree,
    );
    expect(parsed?.className).toBe('User');
    expect(Object.keys(parsed?.children ?? {})).toHaveLength(0);
  });

  it('returns an empty root for a missing model', () => {
    const parsed = parseUserDiagramModel(null, syntheticTree);
    expect(parsed?.className).toBe('User');
    expect(Object.keys(parsed?.children ?? {})).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Metamodel-tree derivation against the real shipped metamodel       */
/* ------------------------------------------------------------------ */

describe('buildMetamodelTree (real metamodel)', () => {
  let tree: MetaTree;

  beforeAll(() => {
    diagramBridge.setClassDiagramData(getUserMetaModelV4());
    tree = buildMetamodelTree();
  });

  it('roots the hierarchy at User with the expected direct parts', () => {
    expect(tree.root?.className).toBe('User');
    const parts = tree.root!.children.map((c) => c.className).sort();
    expect(parts).toEqual(['Accessibility', 'Competence', 'Culture', 'Personal_Information'].sort());
  });

  it('nests Disability (repeatable) under Accessibility', () => {
    const accessibility = tree.byClassName.Accessibility;
    const disabilityRef = accessibility.children.find((c) => c.className === 'Disability');
    expect(disabilityRef).toBeDefined();
    expect(disabilityRef!.multiplicity).toBe('multiple');
  });

  it('nests Skill / Language / Education (repeatable) under Competence', () => {
    const competence = tree.byClassName.Competence;
    const childNames = competence.children.map((c) => c.className).sort();
    expect(childNames).toEqual(['Education', 'Language', 'Skill']);
    competence.children.forEach((c) => expect(c.multiplicity).toBe('multiple'));
  });

  it('resolves enumeration attributes to their literal values', () => {
    const affects = tree.byClassName.Disability.attributes.find((a) => a.name === 'affects');
    expect(affects?.type).toBe('AspectsEnum');
    expect(affects?.enumValues && affects.enumValues.length).toBeGreaterThan(0);

    const religion = tree.byClassName.Culture.attributes.find((a) => a.name === 'religion');
    expect(religion?.enumValues).toContain('Islam');
  });

  it('leaves primitive attributes without enum values', () => {
    const age = tree.byClassName.Personal_Information.attributes.find((a) => a.name === 'age');
    expect(age?.type).toBe('int');
    expect(age?.enumValues).toBeUndefined();

    const lastName = tree.byClassName.Personal_Information.attributes.find((a) => a.name === 'lastName');
    expect(lastName?.enumValues).toBeUndefined();
  });

  it('keeps enumerations out of the part tree', () => {
    expect(Object.keys(tree.byClassName).some((n) => n.endsWith('Enum'))).toBe(false);
  });

  it('seeds the bridge with the metamodel when it holds an unrelated class diagram', () => {
    diagramBridge.setClassDiagramData({ nodes: [], edges: [] });
    const rebuilt = buildMetamodelTree();
    expect(rebuilt.root?.className).toBe('User');
    expect(rebuilt.root!.children.length).toBeGreaterThan(0);
  });
});
