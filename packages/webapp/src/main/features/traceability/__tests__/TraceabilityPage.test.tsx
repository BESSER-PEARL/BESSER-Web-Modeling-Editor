import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyTraceFile } from '../../../shared/types/traceability';
import type { TraceFile } from '../../../shared/types/traceability';
import { reportTraceLoadProblem, clearTraceLoadProblem } from '../../../shared/traceability/traceLoadStatus';

const time = '2026-10-29T10:00:00.000Z';
const later = '2026-10-29T11:00:00.000Z';

/** Class Book generated into lines 2-3 of sql_alchemy.py, then renamed. */
function trace(): TraceFile {
  return {
    ...emptyTraceFile('p1'),
    actors: [{ id: 'ada', type: 'Person', name: 'Ada', timestamp: time }],
    tools: [{ id: 'gen', type: 'CodeGenerator', name: 'sqlalchemy', timestamp: time }],
    artifacts: [
      { id: 'cd', type: 'ModelArtifact', name: 'Class Diagram', elementId: 'd1', elementType: 'DomainModel', timestamp: time },
      { id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', parentId: 'cd', timestamp: time },
      { id: 'file', type: 'CodeArtifact', name: 'sql_alchemy.py', path: 'sql_alchemy.py', contentHash: 'h', content: 'a\nclass Book:\n  pass\n', timestamp: time },
      { id: 'lines', type: 'CodeArtifact', name: 'Book (2-3)', path: 'sql_alchemy.py', contentHash: 'h2', startLine: 2, endLine: 3, parentId: 'file', timestamp: time },
    ],
    operations: [
      { id: 'run', type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: time, endedAt: time, performedBy: ['ada'],
        toolCalls: [{ id: 'rc', toolId: 'gen', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: time, logs: [] }],
        reads: ['cd', 'book'], writes: ['file', 'lines'] },
      { id: 'edit', type: 'ModelingSession', status: 'SUCCEEDED', startedAt: later, endedAt: later, performedBy: ['ada'], toolCalls: [],
        reads: [], writes: [],
        changes: [{ id: 'ch', kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: 'Libro', newValue: 'Book', timestamp: later }] },
    ],
    traceLinks: [{
      id: 'link', sourceId: 'book', targetId: 'lines', operationId: 'run', timestamp: time,
      evidence: [{ id: 'ev', type: 'RuleEvidence', rule: 'class', timestamp: time }],
    }],
  };
}

const state = vi.hoisted(() => ({
  project: { id: 'p1', name: 'Library', settings: { traceabilityEnabled: true } } as Record<string, unknown> | null,
  trace: null as TraceFile | null,
  enabled: true,
}));

vi.mock('../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: state.project }) }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../../app/store/workspaceSlice', () => ({ setTraceabilityEnabledThunk: vi.fn() }));
vi.mock('../../../shared/traceability/traceStore', () => ({
  useProjectTrace: () => state.trace,
  isTraceabilityEnabled: () => state.enabled,
  deleteProjectTrace: vi.fn(),
  loadProjectTrace: vi.fn(),
}));

// After the mocks: the page imports them.
const { TraceabilityPage } = await import('../TraceabilityPage');

let location = '';
let navigate: ReturnType<typeof useNavigate>;
const Probe: React.FC = () => {
  const current = useLocation();
  location = `${current.pathname}${current.search}`;
  navigate = useNavigate();
  return null;
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
      <Routes>
        <Route path="/traceability" element={<TraceabilityPage />} />
      </Routes>
    </MemoryRouter>,
  );

const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent;

describe('TraceabilityPage', () => {
  beforeEach(() => {
    state.project = { id: 'p1', name: 'Library' };
    state.trace = trace();
    state.enabled = true;
    clearTraceLoadProblem('p1');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 10, top: 0, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) });
  });

  it('opens the tab, root and element the URL names, from an editor element id too', () => {
    renderAt('/traceability?tab=lineage&root=c1');
    expect(selectedTab()).toBe('Lineage');
    expect(screen.getByRole('button', { name: 'Lineage of: Book' })).toBeTruthy();
  });

  it('keeps the tab in the URL, so back and forward walk the views', () => {
    renderAt('/traceability');
    expect(selectedTab()).toBe('Timeline');
    fireEvent.click(screen.getByRole('tab', { name: 'Coverage' }));
    expect(location).toBe('/traceability?tab=coverage');
    expect(selectedTab()).toBe('Coverage');
    act(() => navigate(-1));
    expect(selectedTab()).toBe('Timeline');
    act(() => navigate(1));
    expect(selectedTab()).toBe('Coverage');
  });

  it('opens an element from another view as a new history entry', () => {
    renderAt('/traceability?tab=coverage');
    fireEvent.click(screen.getByRole('button', { name: 'Book' }));
    expect(location).toBe('/traceability?tab=elements&element=book');
    expect(screen.getByRole('heading', { name: 'Book' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Show lineage/ }));
    expect(location).toBe('/traceability?tab=lineage&root=book&element=book');
  });

  it('moves between tabs with the arrow keys, each tab controlling its panel', () => {
    renderAt('/traceability?tab=timeline');
    const tab = screen.getByRole('tab', { name: 'Timeline' });
    expect(tab.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(selectedTab()).toBe('Diagrams');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Diagrams' }), { key: 'End' });
    expect(selectedTab()).toBe('Requirements');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Requirements' }));
  });

  it('falls back on the default view for an unknown tab or id, and says so for the id', () => {
    renderAt('/traceability?tab=nope&root=gone');
    expect(selectedTab()).toBe('Timeline');
    expect(screen.getByText(/does not hold/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(location).toBe('/traceability?tab=timeline');
  });

  it('starts over when another project is opened', () => {
    const { rerender } = renderAt('/traceability?tab=lineage&root=book');
    state.project = { id: 'p2', name: 'Other' };
    state.trace = { ...emptyTraceFile('p2') };
    rerender(
      <MemoryRouter initialEntries={['/traceability?tab=lineage&root=book']}>
        <Probe />
        <Routes>
          <Route path="/traceability" element={<TraceabilityPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(location).toBe('/traceability?tab=timeline');
  });

  it('sums the trace up: links, the out-of-date ones and the generators to run again', () => {
    renderAt('/traceability');
    const summary = screen.getByRole('region', { name: 'Trace summary' });
    expect(summary.textContent).toContain('2operations recorded');
    expect(summary.textContent).toContain('1current trace link');
    expect(summary.textContent).toContain('1link may be out of date');
    expect(summary.textContent).toContain('sqlalchemy: 1 file out of date');
    fireEvent.click(screen.getByRole('button', { name: 'View coverage' }));
    expect(selectedTab()).toBe('Coverage');
  });

  it('says when recording is off but a trace exists, and when the stored trace could not be loaded', () => {
    state.enabled = false;
    reportTraceLoadProblem('p1', 'unusable');
    renderAt('/traceability');
    expect(screen.getByText('Trace recording is off')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turn recording on' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('The stored trace could not be loaded');
  });
});
