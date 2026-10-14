/**
 * An aggregation whose only navigable end is the whole draws an arrowhead in
 * front of the diamond (the RhombusArrow marker, 52px long). The end's role and
 * multiplicity labels were still placed for a 30px marker, on top of it.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';

import { UMLAssociationComponent } from '../../../../editor/src/main/packages/common/uml-association/uml-association-component';
import { UMLClassAggregation } from '../../../../editor/src/main/packages/uml-class-diagram/uml-class-aggregation/uml-class-aggregation';
import { Point } from '../../../../editor/src/main/utils/geometry/point';
import { defaults as theme } from '../../../../editor/src/main/components/theme/styles';

const targetLabelX = (sourceNavigable: boolean, targetNavigable: boolean) => {
  const element = new UMLClassAggregation({
    id: 'agg',
    path: [new Point(0, 0), new Point(300, 0)],
    source: { navigable: sourceNavigable, multiplicity: '*', role: 'parts' },
    target: { navigable: targetNavigable, multiplicity: '1', role: 'whole' },
  } as any);
  const { container } = render(
    <ThemeProvider theme={theme()}>
      <svg>
        <UMLAssociationComponent element={element} />
      </svg>
    </ThemeProvider>,
  );
  const role = Array.from(container.querySelectorAll('text')).find((t) => t.textContent === 'whole')!;
  return Number(role.getAttribute('x'));
};

describe('aggregation end labels', () => {
  it('clear the diamond-plus-arrowhead marker at a navigable whole end', () => {
    // The line ends at x=300; the marker covers x in [248, 300].
    expect(targetLabelX(false, true)).toBeLessThanOrEqual(300 - 52);
  });

  it('keep their position next to a plain diamond', () => {
    expect(targetLabelX(true, true)).toBe(300 - 31);
  });
});
