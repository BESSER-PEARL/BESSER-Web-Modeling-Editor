import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TIMELINE_PAGE_SIZE, TimelineView } from '../TimelineView';
import { indexTrace } from '../../../shared/traceability/traceQueries';
import { emptyTraceFile } from '../../../shared/types/traceability';
import type { TraceFile, TraceOperation } from '../../../shared/types/traceability';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 30, 10, minute)).toISOString();

function history(sessions: number): TraceFile {
  return {
    ...emptyTraceFile('p1'),
    actors: [{ id: 'ada', type: 'Person', name: 'Ada', timestamp: at(0) }],
    artifacts: [{ id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', timestamp: at(0) }],
    operations: Array.from({ length: sessions }, (_, i) => ({
      id: `m${i}`, type: 'Modeling', status: 'SUCCEEDED', startedAt: at(i), performedBy: ['ada'], uses: [], consumes: [], produces: [], logs: [],
      changes: [{ id: `c${i}`, kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: `v${i}`, newValue: `v${i + 1}`, timestamp: at(i) }],
    }) as TraceOperation),
  };
}

describe('TimelineView paging', () => {
  it('shows a page of operations and the next one on demand', () => {
    // Plain DOM queries: role queries walk every element and are slow on a page of 60 cards.
    const { container } = render(<TimelineView index={indexTrace(history(TIMELINE_PAGE_SIZE + 10))} onOpenElement={() => {}} />);
    const cards = () => container.querySelectorAll('ol > li').length;
    expect(cards()).toBe(TIMELINE_PAGE_SIZE);
    fireEvent.click(screen.getByText('Show 10 more (10 older)'));
    expect(cards()).toBe(TIMELINE_PAGE_SIZE + 10);
    expect(screen.queryByText(/^Show \d+ more/)).toBeNull();
  });
});
