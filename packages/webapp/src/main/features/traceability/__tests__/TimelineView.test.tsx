import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimelineView } from '../TimelineView';
import { indexTrace } from '../../../shared/traceability/traceQueries';
import { emptyTraceFile } from '../../../shared/types/traceability';
import type { TraceFile } from '../../../shared/types/traceability';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 30, 10, minute)).toISOString();
const base = { status: 'SUCCEEDED' as const, uses: [], consumes: [], produces: [], logs: [] };

function trace(): TraceFile {
  return {
    ...emptyTraceFile('p1'),
    actors: [
      { id: 'ada', type: 'Person', name: 'Ada', timestamp: at(0) },
      { id: 'bot', type: 'Agent', name: 'BESSER modeling assistant', timestamp: at(0) },
    ],
    tools: [{ id: 'gen', type: 'CodeGenerator', name: 'sqlalchemy', timestamp: at(0) }],
    artifacts: [{ id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', timestamp: at(0) }],
    operations: [
      { ...base, id: 'm1', type: 'Modeling', startedAt: at(1), performedBy: ['ada'],
        changes: [{ id: 'c1', kind: 'CREATED', artifactId: 'book', newValue: 'Book', timestamp: at(1) }] },
      { ...base, id: 'm2', type: 'Modeling', startedAt: at(2), performedBy: ['ada', 'bot'],
        changes: [{ id: 'c2', kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: 'Book', newValue: 'Volume', timestamp: at(2) }] },
      { ...base, id: 'g', type: 'CodeGeneration', startedAt: at(3), performedBy: ['ada'], uses: ['gen'] },
      { ...base, id: 'chat', type: 'Conversation', startedAt: at(4), performedBy: ['ada', 'bot'],
        logs: [
          { id: 'l1', content: 'What does Book hold?', sequenceNumber: 1, logType: 'INPUT_REQUEST', timestamp: at(4) },
          { id: 'l2', content: 'A title.', sequenceNumber: 2, logType: 'OUTPUT_RESPONSE', timestamp: at(4) },
        ] },
    ],
  };
}

describe('TimelineView filters', () => {
  const titles = () => screen.queryAllByText(/session|Generated|Conversation with/).map((e) => e.textContent);

  it('filters by the kind of operation: Modeling includes the assistant’s edits', () => {
    render(<TimelineView index={indexTrace(trace())} onOpenElement={() => {}} />);
    expect(titles()).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Modeling' }));
    expect(titles()).toEqual(['Modeling session with the assistant', 'Modeling session']);
    fireEvent.click(screen.getByRole('button', { name: 'Code generation' }));
    expect(titles()).toEqual(['Generated sqlalchemy']);
  });

  it('shows a conversation with its messages', () => {
    render(<TimelineView index={indexTrace(trace())} onOpenElement={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conversations' }));
    expect(titles()).toEqual(['Conversation with the assistant']);
    expect(screen.getByText('2 messages')).toBeTruthy();
    fireEvent.click(screen.getByText('Conversation with the assistant'));
    expect(screen.getByText('What does Book hold?')).toBeTruthy();
    expect(screen.getByText('A title.')).toBeTruthy();
  });
});
