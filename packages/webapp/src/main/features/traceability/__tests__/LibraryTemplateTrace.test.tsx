import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { indexTrace } from '../../../shared/traceability/traceQueries';
import { MODEL_GENERATORS } from '../../../shared/traceability/traceStore';
import { emptyTraceFile } from '../../../shared/types/traceability';
import type { TraceFile } from '../../../shared/types/traceability';
import { TimelineView } from '../TimelineView';
import { ElementsView } from '../ElementsView';

const at = (minute: number) => new Date(Date.UTC(2026, 10, 18, 10, minute)).toISOString();
const base = { status: 'SUCCEEDED' as const, toolCalls: [], reads: [], writes: [] };
const call = (id: string, toolId: string, minute: number) => ({
  id, toolId, sequenceNumber: 0, status: 'SUCCEEDED' as const, startedAt: at(minute), logs: [],
});

/** Live, 2026-11-18: a fresh project from the Library template, recording on, then Python Classes and SQLAlchemy generated. */
function libraryProject(): TraceFile {
  return {
    ...emptyTraceFile('p1'),
    actors: [{ id: 'ada', type: 'Person', name: 'Ada', timestamp: at(0) }],
    tools: [
      { id: 'tpl', type: 'ModelGenerator', name: MODEL_GENERATORS.template, timestamp: at(0) },
      { id: 'py', type: 'CodeGenerator', name: 'python', timestamp: at(0) },
      { id: 'sa', type: 'CodeGenerator', name: 'sqlalchemy', timestamp: at(0) },
    ],
    artifacts: [
      { id: 'cd', type: 'ModelArtifact', name: 'Library', elementId: 'd1', elementType: 'DomainModel', timestamp: at(1) },
      { id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', parentId: 'cd', timestamp: at(1) },
      { id: 'title', type: 'ModelArtifact', name: 'title', elementId: 'a1', elementType: 'Property', parentId: 'book', timestamp: at(1) },
      { id: 'pyFile', type: 'CodeArtifact', name: 'classes.py', path: 'classes.py', contentHash: 'h1', timestamp: at(2) },
      { id: 'pyBook', type: 'CodeArtifact', name: 'Book', path: 'classes.py', contentHash: 'h1', startLine: 1, endLine: 3, parentId: 'pyFile', timestamp: at(2) },
      { id: 'saFile', type: 'CodeArtifact', name: 'sql_alchemy.py', path: 'sql_alchemy.py', contentHash: 'h2', timestamp: at(3) },
      { id: 'saBook', type: 'CodeArtifact', name: 'Book', path: 'sql_alchemy.py', contentHash: 'h2', startLine: 5, endLine: 9, parentId: 'saFile', timestamp: at(3) },
    ],
    operations: [
      { ...base, id: 'load', type: 'ModelingSession', startedAt: at(1), performedBy: ['ada'], toolCalls: [call('lc', 'tpl', 1)],
        changes: [
          { id: 'c1', kind: 'CREATED', artifactId: 'book', newValue: 'Book', timestamp: at(1) },
          { id: 'c2', kind: 'CREATED', artifactId: 'title', newValue: 'title', timestamp: at(1) },
        ] },
      { ...base, id: 'genPy', type: 'CodeGeneration', startedAt: at(2), performedBy: ['ada'], writes: ['pyFile', 'pyBook'],
        toolCalls: [call('pc', 'py', 2)] },
      { ...base, id: 'genSa', type: 'CodeGeneration', startedAt: at(3), performedBy: ['ada'], writes: ['saFile', 'saBook'],
        toolCalls: [call('sc', 'sa', 3)] },
    ],
    traceLinks: [
      { id: 'lPy', sourceId: 'book', targetId: 'pyBook', operationId: 'genPy', timestamp: at(2), evidence: [] },
      { id: 'lSa', sourceId: 'book', targetId: 'saBook', operationId: 'genSa', timestamp: at(3), evidence: [] },
    ],
  };
}

const noop = () => {};

describe('a project loaded from the Library template', () => {
  it('credits the template load to the template library in the Timeline, not to a modeling session', () => {
    // Live: the header read "Modeling session", though templates are recorded as their source, not as user edits.
    render(<TimelineView index={indexTrace(libraryProject())} onOpenElement={noop} />);
    expect(screen.getByText('Written by BESSER template library')).toBeTruthy();
    expect(screen.queryByText('Modeling session')).toBeNull();
  });

  it('credits the template library in an element’s History', () => {
    // Live: "Created attribute title … Modeling session · <owner>".
    const { container } = render(<ElementsView index={indexTrace(libraryProject())} selectedId="title" onSelect={noop} onShowLineage={noop} />);
    const entry = [...container.querySelectorAll('li')].find((li) => li.textContent?.startsWith('Created attribute title'));
    expect(entry?.textContent).toContain('Written by BESSER template library · Ada');
    expect(entry?.textContent).not.toContain('Modeling session');
  });
});
