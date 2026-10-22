/* @vitest-environment jsdom */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SpecsListEditor } from '../SpecsListEditor';
import { kgStylesheet } from '../stylesheet';
import { KG_CONSTRAINT_TARGET_CLASS, KG_CONSTRAINT_TARGET_PROPERTY, KG_SH_PROPERTY } from '../types';
import type { KnowledgeGraphData } from '../types';

const MODEL: KnowledgeGraphData = {
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [
    { id: 'c', nodeType: 'class', label: 'C', iri: 'http://ex.org/C' },
    { id: 'shape', nodeType: 'propertyConstraint', label: 'S' },
  ],
  edges: [],
};

describe('datalist ids', () => {
  it('stay the same when the editor re-renders (they used to be re-randomised every render)', () => {
    const props = {
      specs: [{ kind: 'allValuesFrom', value: 'http://ex.org/C' }],
      onChange: () => {},
      nodeType: 'propertyConstraint' as const,
      ownerNodeId: 'shape',
      model: MODEL,
      depth: 0,
    };
    const { container, rerender } = render(<SpecsListEditor {...props} />);
    const before = [...container.querySelectorAll('datalist')].map((d) => d.id);
    expect(before.length).toBeGreaterThan(0);

    rerender(<SpecsListEditor {...props} />);
    const after = [...container.querySelectorAll('datalist')].map((d) => d.id);

    expect(after).toEqual(before);
  });
});

describe('constraint edges in the stylesheet', () => {
  it.each([KG_CONSTRAINT_TARGET_CLASS, KG_CONSTRAINT_TARGET_PROPERTY, KG_SH_PROPERTY])(
    'draw %s as a dashed constraint connection, using the shared IRI constant',
    (iri) => {
      const rule = kgStylesheet.find((r) => r.selector === `edge[iri = "${iri}"]`) as
        | { style: Record<string, unknown> }
        | undefined;

      expect(rule).toBeDefined();
      expect(rule!.style['line-style']).toBe('dashed');
    },
  );
});
