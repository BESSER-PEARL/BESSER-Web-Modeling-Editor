import * as React from 'react';
import { wrappedRender } from '../../../test-utils/render';
import { Point } from '../../../../../main/utils/geometry/point';
import { UMLAssociationComponent } from '../../../../../main/packages/common/uml-association/uml-association-component';
import { UMLAssociation } from '../../../../../main/packages/common/uml-association/uml-association';
import { UMLClassBidirectional } from '../../../../../main/packages/uml-class-diagram/uml-class-bidirectional/uml-class-bidirectional';
import { UMLClassComposition } from '../../../../../main/packages/uml-class-diagram/uml-class-composition/uml-class-composition';
import { UMLClassAggregation } from '../../../../../main/packages/uml-class-diagram/uml-class-aggregation/uml-class-aggregation';

type AssociationClass = typeof UMLClassBidirectional | typeof UMLClassComposition | typeof UMLClassAggregation;

const renderMarkers = (Type: AssociationClass, sourceNavigable: boolean, targetNavigable: boolean) => {
  const element: UMLAssociation = new Type({
    id: 'assoc',
    path: [new Point(0, 0), new Point(100, 100)],
    source: { navigable: sourceNavigable },
    target: { navigable: targetNavigable },
  });
  const { container } = wrappedRender(
    <svg>
      <UMLAssociationComponent element={element} />
    </svg>,
  );
  const polyline = container.querySelector('polyline')!;
  const marker = (attribute: string): SVGMarkerElement | undefined => {
    const reference = polyline.getAttribute(attribute);
    if (!reference) return undefined;
    const id = reference.replace(/^url\(#(.*)\)$/, '$1');
    return (container.querySelector(`marker[id="${id}"]`) as SVGMarkerElement | null) ?? undefined;
  };
  // the `d` of every <path> in a marker: arrow = 1 path, diamond = 1 path, arrow + diamond = 2 paths
  const shape = (m?: SVGMarkerElement) =>
    m ? Array.from(m.querySelectorAll('path')).map((p) => p.getAttribute('d')) : undefined;
  return { start: marker('marker-start'), end: marker('marker-end'), shape };
};

const ARROW = 'M0,29 L30,15 L0,1';
const DIAMOND = 'M0,15 L15,22 L30,15 L15,8 z';

describe('association end markers follow navigability', () => {
  it('draws no arrow when both ends of an association are navigable', () => {
    const { start, end } = renderMarkers(UMLClassBidirectional, true, true);
    expect(start).toBeUndefined();
    expect(end).toBeUndefined();
  });

  it('draws an arrow at the target when only the target is navigable', () => {
    const { start, end, shape } = renderMarkers(UMLClassBidirectional, false, true);
    expect(start).toBeUndefined();
    expect(shape(end)).toEqual([ARROW]);
  });

  it('draws a reversed arrow at the source when only the source is navigable', () => {
    const { start, end, shape } = renderMarkers(UMLClassBidirectional, true, false);
    expect(end).toBeUndefined();
    expect(shape(start)).toEqual([ARROW]);
    expect(start!.getAttribute('orient')).toEqual('auto-start-reverse');
  });

  it('keeps the composition diamond and adds an arrow at the part end when the whole is not navigable', () => {
    const both = renderMarkers(UMLClassComposition, true, true);
    expect(both.start).toBeUndefined();
    expect(both.end).toBeDefined();

    const partOnly = renderMarkers(UMLClassComposition, true, false);
    expect(partOnly.shape(partOnly.start)).toEqual([ARROW]);
    expect(partOnly.end).toBeDefined();
  });

  it('applies navigability to aggregations without touching the diamond', () => {
    const both = renderMarkers(UMLClassAggregation, true, true);
    expect(both.start).toBeUndefined();
    expect(both.shape(both.end)).toEqual([DIAMOND]);

    const partOnly = renderMarkers(UMLClassAggregation, true, false);
    expect(partOnly.shape(partOnly.start)).toEqual([ARROW]);
    expect(partOnly.shape(partOnly.end)).toEqual([DIAMOND]);

    const wholeOnly = renderMarkers(UMLClassAggregation, false, true);
    expect(wholeOnly.start).toBeUndefined();
    expect(wholeOnly.shape(wholeOnly.end)).toEqual(['M0,29 L22,15 L0,1', 'M22,15 L37,22 L52,15 L37,8 z']);
  });
});
