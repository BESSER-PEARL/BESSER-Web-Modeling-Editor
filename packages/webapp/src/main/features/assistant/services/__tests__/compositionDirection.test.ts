/**
 * The whole of a composition is its TARGET end (BESSER-PEARL/BESSER#746).
 *
 * The editor draws the filled diamond at the target end and the backend's
 * JSON -> BUML conversion marks the target end composite, so the class the
 * diamond sits on must be the whole. A class extracted from another one is
 * that class's part: the diamond belongs on the original class.
 */
import { describe, expect, it } from 'vitest';

import { ClassDiagramConverter } from '../converters/ClassDiagramConverter';
import { ClassDiagramModifier } from '../modifiers/ClassDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import { isWholePartType } from '../shared/relationshipMapping';
import type { BESSERModel } from '../UMLModelingService';

function userModel(): BESSERModel {
  return {
    version: '4.0.0',
    id: 'm',
    title: '',
    type: 'ClassDiagram',
    nodes: [
      {
        id: 'class_User',
        type: 'class',
        position: { x: 0, y: 0 },
        width: 220,
        height: 140,
        measured: { width: 220, height: 140 },
        data: {
          name: 'User',
          methods: [],
          attributes: [
            { id: 'attr_name', name: 'name', attributeType: 'str', visibility: 'public' },
            { id: 'attr_street', name: 'street', attributeType: 'str', visibility: 'public' },
            { id: 'attr_city', name: 'city', attributeType: 'str', visibility: 'public' },
          ],
        },
      },
    ],
    edges: [],
    assessments: {},
  } as unknown as BESSERModel;
}

const classId = (model: BESSERModel, name: string) =>
  (model.nodes as any[]).find((node) => node.type === 'class' && node.data?.name === name)!.id;

const onlyRelationship = (model: BESSERModel) => {
  const rels = model.edges as any[];
  expect(rels).toHaveLength(1);
  return rels[0];
};

describe('composition direction', () => {
  it('extract_class puts the diamond (target) on the class the part came from', () => {
    const result = new ClassDiagramModifier().applyModification(userModel(), {
      action: 'extract_class',
      sourceClass: 'User',
      newClass: 'Address',
      attributes: ['street', 'city'],
      relationshipType: 'ClassComposition',
    } as unknown as ModelModification);

    const rel = onlyRelationship(result);
    expect(rel.type).toBe('ClassComposition');
    expect(rel.target).toBe(classId(result, 'User'));
    expect(rel.source).toBe(classId(result, 'Address'));
    // A part belongs to exactly one whole: the whole end is single-valued.
    expect(rel.data.targetMultiplicity).toBe('1');
  });

  it('promote_attribute makes the promoted class the part', () => {
    const result = new ClassDiagramModifier().applyModification(userModel(), {
      action: 'promote_attribute',
      sourceClass: 'User',
      attribute: 'street',
      newClass: 'Street',
      newAttributes: [{ name: 'line', type: 'str' }],
    } as unknown as ModelModification);

    const rel = onlyRelationship(result);
    expect(rel.type).toBe('ClassComposition');
    expect(rel.target).toBe(classId(result, 'User'));
    expect(rel.source).toBe(classId(result, 'Street'));
    expect(rel.data.sourceNavigable).toBe(true);
  });

  it('extract_class with an association keeps the original class as the source', () => {
    const result = new ClassDiagramModifier().applyModification(userModel(), {
      action: 'extract_class',
      sourceClass: 'User',
      newClass: 'Address',
      attributes: ['street'],
      relationshipType: 'Association',
    } as unknown as ModelModification);

    const rel = onlyRelationship(result);
    expect(rel.type).toBe('ClassBidirectional');
    expect(rel.source).toBe(classId(result, 'User'));
  });

  it('passes an agent composition through as is: the target class is the whole', () => {
    // Brand is the whole of BrandURL: the agent sends the part as source.
    const model = new ClassDiagramConverter().convertCompleteSystem({
      systemName: 'Brands',
      classes: [
        { className: 'Brand', attributes: [], methods: [] },
        { className: 'BrandURL', attributes: [], methods: [] },
      ],
      relationships: [
        {
          type: 'Composition',
          source: 'BrandURL',
          target: 'Brand',
          sourceMultiplicity: '0..*',
          targetMultiplicity: '1',
          name: 'brand',
          sourceRole: 'urls',
        },
      ],
    });

    const rel = onlyRelationship(model as BESSERModel);
    expect(rel.type).toBe('ClassComposition');
    expect(rel.target).toBe(classId(model as BESSERModel, 'Brand'));
    expect(rel.data.targetMultiplicity).toBe('1');
  });

  it('recognises both spellings of the whole/part types', () => {
    expect(isWholePartType('Composition')).toBe(true);
    expect(isWholePartType('ClassAggregation')).toBe(true);
    expect(isWholePartType('Association')).toBe(false);
    expect(isWholePartType('Inheritance')).toBe(false);
  });
});
