import { describe, it, expect, beforeAll } from 'vitest';
import { diagramBridge } from '@besser/wme';
import type { UMLModel } from '@besser/wme';
// The fixed user metamodel shipped with the editor package.
import userMetaModel from '../../../../../../../editor/src/main/packages/user-modeling/usermetamodel_buml_short.json';
import { buildMetamodelTree, MetaTree } from '../metamodel-tree';
import {
  buildUserDiagramModel,
  parseUserDiagramModel,
  parseUserDiagramProfiles,
  createEmptyInstance,
  instanceSignature,
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

describe('user-profile-form serialization', () => {
  it('builds a UserDiagram model with the expected boxes, criteria and links', () => {
    const root = buildSampleProfile(syntheticTree);
    const model = buildUserDiagramModel(root, syntheticTree) as any;

    expect(model.type).toBe('UserDiagram');

    const boxes = Object.values(model.elements).filter((e: any) => e.type === 'UserModelName');
    const attrs = Object.values(model.elements).filter((e: any) => e.type === 'UserModelAttribute');
    const links = Object.values(model.relationships);

    // User + Personal_Information + Accessibility + 2 Disabilities = 5 boxes
    expect(boxes).toHaveLength(5);
    // Links: PI, Accessibility, 2 Disabilities = 4 (User is the root, no inbound link)
    expect(links).toHaveLength(4);
    // Every metamodel attribute becomes a row: PI.age(1) + d1(name,affects) + d2(name,affects) = 5
    expect(attrs).toHaveLength(5);

    const ageAttr = attrs.find((a: any) => a.name.startsWith('age')) as any;
    expect(ageAttr.name).toBe('age >= 18');
    expect(ageAttr.attributeOperator).toBe('>=');
    expect(ageAttr.attributeId).toBe('a-pi-age');

    // className is preserved on every box
    expect((boxes as any[]).every((b) => typeof b.className === 'string')).toBe(true);
    expect(links.every((l: any) => l.type === 'ObjectLink')).toBe(true);
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
    const boxes = Object.values(model.elements).filter((e: any) => e.type === 'UserModelName');
    const attrs = Object.values(model.elements).filter((e: any) => e.type === 'UserModelAttribute');

    expect(boxes).toHaveLength(3); // User + Accessibility + Disability
    // Disability has 2 metamodel attributes; both appear as rows though unset.
    expect(attrs).toHaveLength(2);
    expect((attrs as any[]).map((a) => a.name).sort()).toEqual(['affects = ', 'name = ']);

    const parsed = parseUserDiagramModel(model, syntheticTree);
    expect(parsed?.children.Accessibility?.[0].children.Disability).toHaveLength(1);
  });

  it('parses values from an editor-serialized model (manually-created shape) without loss', () => {
    // Mimics what the editor stores for a hand-built model: boxes carry
    // className, attribute children carry the criterion in `name` plus the
    // editor's own visibility/attributeType metadata (which parse ignores).
    const model = {
      type: 'UserDiagram',
      elements: {
        u1: { id: 'u1', type: 'UserModelName', name: 'user_1', className: 'User', owner: null, attributes: [] },
        pi1: {
          id: 'pi1', type: 'UserModelName', name: 'personal_Information_1',
          className: 'Personal_Information', owner: null, attributes: ['a1'],
        },
        a1: {
          id: 'a1', type: 'UserModelAttribute', name: 'age >= 30', owner: 'pi1',
          attributeId: 'a-pi-age', attributeOperator: '>=', visibility: 'public', attributeType: 'str',
        },
      },
      relationships: {
        r1: { id: 'r1', type: 'ObjectLink', source: { element: 'u1' }, target: { element: 'pi1' } },
      },
    } as unknown as UMLModel;

    const parsed = parseUserDiagramModel(model, syntheticTree);
    const pi = parsed?.children.Personal_Information?.[0];
    const age = pi?.attributes.find((a) => a.name === 'age');
    expect(age?.value).toBe('30');
    expect(age?.operator).toBe('>=');

    // Re-building from the parsed state keeps the value (no emptying on write-back).
    const rebuilt = buildUserDiagramModel(parsed, syntheticTree) as any;
    const ageRow = Object.values(rebuilt.elements).find((e: any) => e.type === 'UserModelAttribute' && e.name.startsWith('age')) as any;
    expect(ageRow.name).toBe('age >= 30');
  });

  it('returns an empty root when the model has no elements', () => {
    const parsed = parseUserDiagramModel(
      { type: 'UserDiagram', elements: {}, relationships: {} } as unknown as UMLModel,
      syntheticTree,
    );
    expect(parsed?.className).toBe('User');
    expect(Object.keys(parsed?.children ?? {})).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Multiple profiles on one canvas                                    */
/* ------------------------------------------------------------------ */

describe('user-profile-form multi-profile serialization', () => {
  const NAME_ATTR = 'name';

  const namedRoot = (tree: MetaTree, name: string): Instance => {
    const root = createEmptyInstance(tree.root!);
    const nameAttr = root.attributes.find((a) => a.name === NAME_ATTR);
    if (nameAttr) nameAttr.value = name;
    return root;
  };

  it('emits several Users into one model and parses them back as separate profiles', () => {
    const a = namedRoot(syntheticTree, 'Alice');
    const pa = createEmptyInstance(syntheticTree.byClassName.Personal_Information);
    pa.attributes[0].operator = '>=';
    pa.attributes[0].value = '18';
    a.children.Personal_Information = [pa];

    const b = namedRoot(syntheticTree, 'Bob');

    const model = buildUserDiagramModel([a, b], syntheticTree) as any;
    const users = Object.values(model.elements).filter(
      (e: any) => e.type === 'UserModelName' && e.className === 'User',
    );
    expect(users).toHaveLength(2);

    const profiles = parseUserDiagramProfiles(model, syntheticTree);
    expect(profiles).toHaveLength(2);
    // Order-insensitive: match by signature.
    const sigs = profiles.map(instanceSignature).sort();
    expect(sigs).toEqual([instanceSignature(a), instanceSignature(b)].sort());
  });

  it('does not stack profiles: each root User gets a distinct x position', () => {
    const model = buildUserDiagramModel(
      [namedRoot(syntheticTree, 'Alice'), namedRoot(syntheticTree, 'Bob')],
      syntheticTree,
    ) as any;
    const userXs = Object.values(model.elements)
      .filter((e: any) => e.type === 'UserModelName' && e.className === 'User')
      .map((e: any) => e.bounds.x);
    expect(new Set(userXs).size).toBe(2);
  });

  it('keeps a box shared between two Users as a single element on round-trip', () => {
    // Raw model: a Culture box linked to both Users (a shared "french" culture).
    const model = {
      type: 'UserDiagram',
      elements: {
        u1: { id: 'u1', type: 'UserModelName', name: 'user_1', className: 'User', owner: null, attributes: ['u1n'] },
        u1n: { id: 'u1n', type: 'UserModelAttribute', name: 'name = Alice', owner: 'u1' },
        u2: { id: 'u2', type: 'UserModelName', name: 'user_2', className: 'User', owner: null, attributes: ['u2n'] },
        u2n: { id: 'u2n', type: 'UserModelAttribute', name: 'name = Bob', owner: 'u2' },
        cult: { id: 'cult', type: 'UserModelName', name: 'culture_1', className: 'Accessibility', owner: null, attributes: [] },
      },
      relationships: {
        r1: { id: 'r1', type: 'ObjectLink', source: { element: 'u1' }, target: { element: 'cult' } },
        r2: { id: 'r2', type: 'ObjectLink', source: { element: 'u2' }, target: { element: 'cult' } },
      },
    } as unknown as UMLModel;

    const profiles = parseUserDiagramProfiles(model, syntheticTree);
    expect(profiles).toHaveLength(2);
    // The shared box shows up under each profile (same backing boxId).
    expect(profiles.every((p) => (p.children.Accessibility?.length ?? 0) === 1)).toBe(true);
    const sharedBoxIds = profiles.map((p) => p.children.Accessibility![0].boxId);
    expect(sharedBoxIds[0]).toBe('cult');
    expect(sharedBoxIds[1]).toBe('cult');

    // Re-emitting must not duplicate the shared box: still exactly one Accessibility box.
    const rebuilt = buildUserDiagramModel(profiles, syntheticTree) as any;
    const accBoxes = Object.values(rebuilt.elements).filter(
      (e: any) => e.type === 'UserModelName' && e.className === 'Accessibility',
    );
    expect(accBoxes).toHaveLength(1);
    // And both Users still link to it (2 inbound links to the shared box).
    const sharedId = (accBoxes[0] as any).id;
    const inbound = Object.values(rebuilt.relationships).filter(
      (r: any) => r.target.element === sharedId || r.source.element === sharedId,
    );
    expect(inbound).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Personalization specs round-trip on both element levels            */
/* ------------------------------------------------------------------ */

describe('user-profile-form personalization round-trip', () => {
  it('preserves profile-level and attribute-level specs through build -> parse', () => {
    const root = createEmptyInstance(syntheticTree.root!);
    // Profile-level spec on the root User.
    root.personalization = { content: { languageComplexity: 'simple', useAbbreviations: true } };

    const pi = createEmptyInstance(syntheticTree.byClassName.Personal_Information);
    pi.attributes[0].operator = '>=';
    pi.attributes[0].value = '18';
    // Attribute-level spec on the age criterion.
    pi.attributes[0].personalization = {
      presentation: { size: 18, font: 'serif' },
      modality: { outputModalities: ['voice'], voiceSpeed: 0.9 },
    };
    root.children.Personal_Information = [pi];

    const model = buildUserDiagramModel(root, syntheticTree) as any;

    // Specs are emitted onto the model elements.
    const userBox = Object.values(model.elements).find(
      (e: any) => e.type === 'UserModelName' && e.className === 'User',
    ) as any;
    expect(userBox.personalization).toEqual(root.personalization);
    const ageRow = Object.values(model.elements).find(
      (e: any) => e.type === 'UserModelAttribute' && e.name.startsWith('age'),
    ) as any;
    expect(ageRow.personalization).toEqual(pi.attributes[0].personalization);

    // And they survive the parse back into form state.
    const parsed = parseUserDiagramModel(model, syntheticTree);
    expect(parsed?.personalization).toEqual(root.personalization);
    const parsedAge = parsed?.children.Personal_Information?.[0].attributes.find((a) => a.name === 'age');
    expect(parsedAge?.personalization).toEqual(pi.attributes[0].personalization);
    expect(instanceSignature(parsed)).toBe(instanceSignature(root));
  });

  it('keeps an attribute-level spec even when the criterion value is empty', () => {
    const root = createEmptyInstance(syntheticTree.root!);
    const pi = createEmptyInstance(syntheticTree.byClassName.Personal_Information);
    // No value on age, but a spec attached.
    pi.attributes[0].personalization = { presentation: { contrast: 'high' } };
    root.children.Personal_Information = [pi];

    const model = buildUserDiagramModel(root, syntheticTree);
    const parsed = parseUserDiagramModel(model, syntheticTree);
    const parsedAge = parsed?.children.Personal_Information?.[0].attributes.find((a) => a.name === 'age');
    expect(parsedAge?.personalization).toEqual({ presentation: { contrast: 'high' } });
    expect(instanceSignature(parsed)).toBe(instanceSignature(root));
  });

  it('instanceSignature changes iff a spec changes', () => {
    const a = createEmptyInstance(syntheticTree.root!);
    const b = createEmptyInstance(syntheticTree.root!);
    expect(instanceSignature(a)).toBe(instanceSignature(b));

    b.personalization = { content: { sentenceLength: 'concise' } };
    expect(instanceSignature(a)).not.toBe(instanceSignature(b));

    a.personalization = { content: { sentenceLength: 'concise' } };
    expect(instanceSignature(a)).toBe(instanceSignature(b));
  });
});

/* ------------------------------------------------------------------ */
/*  Metamodel-tree derivation against the real shipped metamodel       */
/* ------------------------------------------------------------------ */

describe('buildMetamodelTree (real metamodel)', () => {
  let tree: MetaTree;

  beforeAll(() => {
    diagramBridge.setClassDiagramData(userMetaModel as unknown as any);
    tree = buildMetamodelTree();
  });

  it('flattens hidden containers: User directly parents Disability/Skill/Language/Education', () => {
    expect(tree.root?.className).toBe('User');
    const parts = tree.root!.children.map((c) => c.className).sort();
    // Accessibility/Competence are hidden grouping containers — dropped from
    // User's direct children and replaced by their own children (repeatable).
    expect(parts).toEqual(
      ['Culture', 'Disability', 'Education', 'Language', 'Personal_Information', 'Skill'].sort(),
    );
    expect(parts).not.toContain('Accessibility');
    expect(parts).not.toContain('Competence');
    // The hoisted children keep their repeatable multiplicity.
    ['Disability', 'Skill', 'Language', 'Education'].forEach((name) => {
      expect(tree.root!.children.find((c) => c.className === name)!.multiplicity).toBe('multiple');
    });
  });

  it('round-trips a profile with Disability + Skill directly under User (flat tree)', () => {
    const root = createEmptyInstance(tree.root!);
    const dis = createEmptyInstance(tree.byClassName.Disability);
    root.children.Disability = [dis];
    const skill = createEmptyInstance(tree.byClassName.Skill);
    root.children.Skill = [skill];

    const model = buildUserDiagramModel(root, tree);
    const parsed = parseUserDiagramModel(model, tree);
    expect(instanceSignature(parsed)).toBe(instanceSignature(root));
    // The form model draws them flat (no Accessibility/Competence box on canvas).
    const classNames = Object.values((model as any).elements)
      .filter((e: any) => e.type === 'UserModelName')
      .map((e: any) => e.className);
    expect(classNames).toContain('Disability');
    expect(classNames).toContain('Skill');
    expect(classNames).not.toContain('Accessibility');
    expect(classNames).not.toContain('Competence');
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
});
