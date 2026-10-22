import { describe, expect, it } from 'vitest';
import { patchesForSimplification } from '../constraintSimplification';

const ORIGINAL = 'context Product inv CorrectProduct: not Product.allInstances()->exists(p | p.price <= 0)';
const NORMAL = 'context Product inv CorrectProduct: self.price > 0';

describe('patchesForSimplification', () => {
  const model = {
    elements: {
      box: {
        type: 'ClassOCLConstraint',
        name: 'CorrectProduct',
        bounds: { x: 10, y: 20, width: 180, height: 80 },
      },
    },
    relationships: {},
  };

  it('replaces the constraint text and links a comment with the original', () => {
    const patches = patchesForSimplification(model, {
      constraints: [{ elementId: 'box', changed: true, expression: NORMAL, original: ORIGINAL }],
    });
    const text = patches.find((patch) => patch.path === '/elements/box/constraint');
    expect(text).toMatchObject({ op: 'add', value: NORMAL });
    const comment = patches.find(
      (patch) => patch.op === 'add' && (patch.value as { type?: string }).type === 'Comments',
    );
    const link = patches.find(
      (patch) => patch.op === 'add' && (patch.value as { type?: string }).type === 'Link',
    );
    expect(comment?.value).toMatchObject({ name: ORIGINAL, type: 'Comments', owner: null });
    expect((comment?.value as { bounds: { x: number } }).bounds.x).toBeGreaterThan(180);
    expect(link?.path).toMatch(/^\/relationships\//);
    expect(link?.value).toMatchObject({
      type: 'Link',
      source: { element: (comment?.value as { id: string }).id },
      target: { element: 'box' },
    });
  });

  it('does not add a comment when the expression did not change', () => {
    const patches = patchesForSimplification(model, {
      constraints: [{ elementId: 'box', changed: false }],
    });
    expect(patches).toEqual([]);
  });

  it('does not add a second comment when that original is already linked', () => {
    const patches = patchesForSimplification(
      {
        elements: {
          ...model.elements,
          note: { type: 'Comments', name: ORIGINAL, bounds: { x: 0, y: 0, width: 10, height: 10 } },
        },
        relationships: {
          link: { type: 'Link', source: { element: 'note' }, target: { element: 'box' } },
        },
      },
      { constraints: [{ elementId: 'box', changed: true, expression: NORMAL, original: ORIGINAL }] },
    );
    expect(patches).toHaveLength(1);
    expect(patches[0].path).toBe('/elements/box/constraint');
  });
});
