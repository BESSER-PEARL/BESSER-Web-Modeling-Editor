/* @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KgRdfExportSection, countSpecs, skippedAt } from '../KgRdfExportSection';
import type { KGNodeData } from '../../../shared/types/project';

const shape = (id: string, kinds: string[], nodeType: KGNodeData['nodeType'] = 'nodeConstraint'): KGNodeData => ({
  id,
  nodeType,
  label: id,
  metadata: { constraintSpecs: kinds.map((kind) => ({ kind })) },
});

// exactCardinality is OWL-only, nodeKind is SHACL-only, minCardinality is in both.
const NODES: KGNodeData[] = [
  { id: 'c', nodeType: 'class', label: 'C' },
  shape('s1', ['exactCardinality', 'minCardinality']),
  shape('s2', ['nodeKind', 'pattern'], 'propertyConstraint'),
];

describe('countSpecs / skippedAt', () => {
  it('counts constraint specs by the vocabularies they can be written in', () => {
    expect(countSpecs(NODES)).toEqual({ total: 4, owlOnly: 1, shaclOnly: 2, both: 1 });
  });

  it('ignores nodes that carry no constraints', () => {
    expect(countSpecs([{ id: 'c', nodeType: 'class', label: 'C' }])).toEqual({ total: 0, owlOnly: 0, shaclOnly: 0, both: 0 });
  });

  it('counts a spec of an unknown kind as present but in neither vocabulary', () => {
    expect(countSpecs([shape('s', ['somethingNew'])])).toEqual({ total: 1, owlOnly: 0, shaclOnly: 0, both: 0 });
  });

  it('skips what only exists in the other vocabulary', () => {
    const stats = countSpecs(NODES);

    expect(skippedAt(stats, 'both')).toBe(0);
    expect(skippedAt(stats, 'owl')).toBe(2); // the two SHACL-only specs
    expect(skippedAt(stats, 'shacl')).toBe(1); // the OWL-only spec
  });
});

describe('KgRdfExportSection', () => {
  it('exports Turtle with both vocabularies by default', () => {
    const onExport = vi.fn();
    render(<KgRdfExportSection nodes={NODES} busy={false} onExport={onExport} />);

    fireEvent.click(screen.getByTestId('kg-rdf-export-button'));

    expect(onExport).toHaveBeenCalledWith('ttl', 'both');
  });

  it('says how many specs will be written', () => {
    render(<KgRdfExportSection nodes={NODES} busy={false} onExport={vi.fn()} />);

    expect(screen.getByTestId('kg-rdf-spec-count')).toHaveTextContent('4 of 4 constraint specs will be emitted');
  });

  it('says so when the graph has no constraints', () => {
    render(<KgRdfExportSection nodes={[]} busy={false} onExport={vi.fn()} />);

    expect(screen.queryByTestId('kg-rdf-spec-count')).toBeNull();
    expect(screen.getByText(/No constraint specs/i)).toBeInTheDocument();
  });

  it('cannot be triggered while another export is running', () => {
    const onExport = vi.fn();
    render(<KgRdfExportSection nodes={NODES} busy onExport={onExport} />);

    const button = screen.getByTestId('kg-rdf-export-button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onExport).not.toHaveBeenCalled();
  });
});
