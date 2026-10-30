import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LineageView } from '../LineageView';
import { indexTrace } from '../../../shared/traceability/traceQueries';
import { emptyTraceFile } from '../../../shared/types/traceability';
import type { TraceFile } from '../../../shared/types/traceability';

const time = '2026-10-29T10:00:00.000Z';
const later = '2026-10-29T11:00:00.000Z';

function trace(): TraceFile {
  return {
    ...emptyTraceFile('p1'),
    actors: [{ id: 'ada', type: 'Person', name: 'Ada', timestamp: time }],
    tools: [{ id: 'gen', type: 'CodeGenerator', name: 'sqlalchemy', version: '8.5.0', timestamp: time }],
    artifacts: [
      { id: 'cd', type: 'ModelArtifact', name: 'Class Diagram', elementId: 'd1', elementType: 'DomainModel', timestamp: time },
      { id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', parentId: 'cd', timestamp: time },
      { id: 'file', type: 'CodeArtifact', name: 'sql_alchemy.py', path: 'sql_alchemy.py', contentHash: 'h', content: 'a\nclass Book:\n  pass\n', timestamp: time },
      { id: 'lines', type: 'CodeArtifact', name: 'Book (2-3)', path: 'sql_alchemy.py', contentHash: 'h2', startLine: 2, endLine: 3, parentId: 'file', timestamp: time },
    ],
    operations: [
      { id: 'run', type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: time, endedAt: time, performedBy: ['ada'], uses: ['gen'],
        consumes: ['cd', 'book'], produces: ['file', 'lines'], logs: [] },
      { id: 'edit', type: 'Modeling', status: 'SUCCEEDED', startedAt: later, endedAt: later, performedBy: ['ada'], uses: [],
        consumes: [], produces: [], logs: [],
        changes: [{ id: 'ch', kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: 'Libro', newValue: 'Book', timestamp: later }] },
    ],
    traceLinks: [{
      id: 'link', sourceId: 'book', targetId: 'lines', operationId: 'run', timestamp: time,
      evidence: [{ id: 'ev', type: 'RuleEvidence', rule: 'sql_alchemy_template.py.j2#class', timestamp: time }],
      confidence: { id: 'cf', value: 1, basedOn: ['ev'], timestamp: time },
    }],
  };
}

describe('LineageView', () => {
  it('shows the lineage of the selected element and the details of a link', () => {
    // jsdom has no layout, so give every box a size for the connectors to be measured.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 10, top: 0, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) });
    render(<LineageView index={indexTrace(trace())} rootId="book" onRootChange={() => {}} onOpenElement={() => {}} />);

    expect(screen.getAllByText('Book').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Lines 2–3/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '1.00' }));
    expect(screen.getByText('Deterministic rule: sql_alchemy_template.py.j2#class')).toBeTruthy();
    expect(screen.getByText(/Suspect: the source changed after the link was made/)).toBeTruthy();
    expect(screen.getByText('Renamed class Libro to Book', { exact: false })).toBeTruthy();
  });

  it('starts from the first diagram when nothing is selected', () => {
    render(<LineageView index={indexTrace(trace())} rootId={null} onRootChange={() => {}} onOpenElement={() => {}} />);
    expect(screen.getAllByText('Class Diagram').length).toBeGreaterThan(0);
  });
});
