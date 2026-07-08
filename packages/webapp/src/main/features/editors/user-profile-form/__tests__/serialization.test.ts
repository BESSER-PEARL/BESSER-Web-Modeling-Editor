import { describe, it, expect, beforeAll } from 'vitest';
import { diagramBridge } from '@besser/wme';
import type { UMLModel } from '@besser/wme';
// The fixed user metamodel shipped with the editor package.
import userMetaModel from '../../../../../../../editor/src/main/packages/user-modeling/usermetamodel_buml_short.json';
import { buildMetamodelTree, MetaTree } from '../metamodel-tree';
import {
  buildUserDiagramModel,
  parseUserDiagramModel,
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
    // Only attributes with a value become criteria: age, d1.name, d1.affects, d2.name = 4
    expect(attrs).toHaveLength(4);

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

  it('omits attributes with empty values as criteria but keeps the part enabled', () => {
    const root = createEmptyInstance(syntheticTree.root!);
    // Accessibility enabled but with no disabilities and no criteria
    root.children.Accessibility = [createEmptyInstance(syntheticTree.byClassName.Accessibility)];

    const model = buildUserDiagramModel(root, syntheticTree) as any;
    const boxes = Object.values(model.elements).filter((e: any) => e.type === 'UserModelName');
    const attrs = Object.values(model.elements).filter((e: any) => e.type === 'UserModelAttribute');

    expect(boxes).toHaveLength(2); // User + Accessibility
    expect(attrs).toHaveLength(0);

    const parsed = parseUserDiagramModel(model, syntheticTree);
    expect(parsed?.children.Accessibility).toHaveLength(1);
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
/*  Metamodel-tree derivation against the real shipped metamodel       */
/* ------------------------------------------------------------------ */

describe('buildMetamodelTree (real metamodel)', () => {
  let tree: MetaTree;

  beforeAll(() => {
    diagramBridge.setClassDiagramData(userMetaModel as unknown as any);
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
});
