import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { indexTrace } from '../../../shared/traceability/traceQueries';
import { emptyTraceFile } from '../../../shared/types/traceability';
import type { TraceFile } from '../../../shared/types/traceability';
import { TimelineView } from '../TimelineView';
import { CoverageView } from '../CoverageView';
import { RequirementsView } from '../RequirementsView';
import { LineageView } from '../LineageView';
import { filterComboItems, SearchableCombobox } from '../components/SearchableCombobox';
import type { ComboItem } from '../components/SearchableCombobox';

const at = (day: number, hour = 10) => new Date(2026, 9, day, hour).toISOString();
const base = { status: 'SUCCEEDED' as const, toolCalls: [], reads: [], writes: [] };

/** Ada modeled Book on the 1st, the assistant chatted and extracted requirements on the 3rd, sqlalchemy ran on the 5th. */
function trace(): TraceFile {
  return {
    ...emptyTraceFile('p1'),
    actors: [
      { id: 'ada', type: 'Person', name: 'Ada', timestamp: at(1) },
      { id: 'bot', type: 'Agent', name: 'BESSER modeling assistant', timestamp: at(1) },
    ],
    tools: [
      { id: 'gen', type: 'CodeGenerator', name: 'sqlalchemy', timestamp: at(1) },
      { id: 'llm', type: 'LLM', name: 'gpt-6-luna', timestamp: at(1) },
    ],
    artifacts: [
      { id: 'cd', type: 'ModelArtifact', name: 'Library', elementId: 'd1', elementType: 'DomainModel', timestamp: at(1) },
      { id: 'book', type: 'ModelArtifact', name: 'Book', elementId: 'c1', elementType: 'Class', parentId: 'cd', timestamp: at(1) },
      { id: 'member', type: 'ModelArtifact', name: 'Member', elementId: 'c2', elementType: 'Class', parentId: 'cd', timestamp: at(1) },
      { id: 'file', type: 'CodeArtifact', name: 'models.py', path: 'app/models.py', contentHash: 'h', timestamp: at(5) },
      { id: 'lines', type: 'CodeArtifact', name: 'Book', path: 'app/models.py', contentHash: 'h', startLine: 2, endLine: 4, parentId: 'file', timestamp: at(5) },
      { id: 'r1', type: 'RequirementArtifact', name: 'Books have an ISBN', quote: 'each book has an ISBN', kind: 'uniqueness', timestamp: at(3) },
      { id: 'r2', type: 'RequirementArtifact', name: 'Members pay fines', quote: 'late members pay a fine', kind: 'rule', timestamp: at(3) },
    ],
    operations: [
      { ...base, id: 'm', type: 'ModelingSession', startedAt: at(1), performedBy: ['ada'],
        changes: [{ id: 'c', kind: 'CREATED', artifactId: 'book', newValue: 'Book', timestamp: at(1) }] },
      { ...base, id: 'chat', type: 'Conversation', startedAt: at(3), performedBy: ['ada', 'bot'],
        toolCalls: [{ id: 't', toolId: 'llm', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: at(3), logs: [
          { id: 'l1', content: 'Build me a lending library', sequenceNumber: 0, logType: 'INPUT_REQUEST', timestamp: at(3) },
        ] }] },
      { ...base, id: 'x', type: 'RequirementExtraction', startedAt: at(3, 11), performedBy: ['bot'], writes: ['r1', 'r2'] },
      { ...base, id: 'g', type: 'CodeGeneration', startedAt: at(5), performedBy: ['ada'], writes: ['file', 'lines'],
        toolCalls: [{ id: 'gc', toolId: 'gen', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: at(5), logs: [] }] },
    ],
    traceLinks: [
      { id: 'real', sourceId: 'r1', targetId: 'book', operationId: 'm', timestamp: at(3), evidence: [] },
      { id: 'gen', sourceId: 'book', targetId: 'lines', operationId: 'g', timestamp: at(5),
        evidence: [{ id: 'e', type: 'RuleEvidence', rule: 'class', timestamp: at(5) }] },
    ],
  };
}

const titles = () => screen.queryAllByText(/^(Modeling session|Generated|Conversation with|Requirements extracted)/).map((e) => e.textContent);

describe('TimelineView search and filters', () => {
  it('searches conversation messages, requirements and file paths', () => {
    render(<TimelineView index={indexTrace(trace())} onOpenElement={() => {}} />);
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'lending library' } });
    expect(titles()).toEqual(['Conversation with the assistant']);
    fireEvent.change(search, { target: { value: 'late members' } });
    expect(titles()).toEqual(['Requirements extracted by the assistant']);
    fireEvent.change(search, { target: { value: 'app/models' } });
    expect(titles()).toEqual(['Generated sqlalchemy']);
    expect(screen.getByText('1 of 4 shown')).toBeTruthy();
  });

  it('marks the active kind filter as pressed', () => {
    render(<TimelineView index={indexTrace(trace())} onOpenElement={() => {}} />);
    const all = screen.getByRole('button', { name: 'All' });
    const generation = screen.getByRole('button', { name: 'Code generation' });
    expect(all.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(generation);
    expect(generation.getAttribute('aria-pressed')).toBe('true');
    expect(all.getAttribute('aria-pressed')).toBe('false');
  });

  it('filters by date range, and clears every filter at once', () => {
    render(<TimelineView index={indexTrace(trace())} onOpenElement={() => {}} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-02' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-03' } });
    expect(titles()).toEqual(['Requirements extracted by the assistant', 'Conversation with the assistant']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(titles()).toHaveLength(4);
  });

  it('translates a failed operation’s status', () => {
    const file = trace();
    file.operations[3].status = 'TIMED_OUT';
    render(<TimelineView index={indexTrace(file)} onOpenElement={() => {}} />);
    expect(screen.getByText('Timed out')).toBeTruthy();
    expect(screen.queryByText('TIMED_OUT')).toBeNull();
  });
});

describe('CoverageView search', () => {
  it('keeps the diagrams and elements that match', () => {
    const { container } = render(<CoverageView index={indexTrace(trace())} onOpenElement={() => {}} />);
    const rows = () => [...container.querySelectorAll('tbody th button:not([aria-label])')].map((b) => b.textContent);
    expect(rows()).toEqual(['Library', 'Book', 'Member']);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'mem' } });
    expect(rows()).toEqual(['Library', 'Member']);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('No diagram or element matches the search.')).toBeTruthy();
  });
});

describe('RequirementsView', () => {
  it('shows each requirement with its elements and code, uncovered ones marked, and jumps to lineage', () => {
    const onShowLineage = vi.fn();
    const onOpenElement = vi.fn();
    const { container } = render(<RequirementsView index={indexTrace(trace())} onOpenElement={onOpenElement} onShowLineage={onShowLineage} />);
    const rows = [...container.querySelectorAll('tbody tr')] as HTMLElement[];
    expect(rows.map((r) => r.dataset.status)).toEqual(['generated', 'uncovered']);
    expect(rows[0].textContent).toContain('Books have an ISBN');
    expect(rows[0].textContent).toContain('app/models.py:2–4');
    expect(rows[0].textContent).toContain('uniqueness');
    expect(rows[1].textContent).toContain('Not covered');
    expect(rows[1].textContent).toContain('business rule');

    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Book' }));
    expect(onOpenElement).toHaveBeenCalledWith('book');
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Show the lineage of Members pay fines' }));
    expect(onShowLineage).toHaveBeenCalledWith('r2');

    fireEvent.click(screen.getByRole('button', { name: 'Not covered (1)' }));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('says so when no requirement was recorded', () => {
    const file = trace();
    file.operations = file.operations.filter((o) => o.type !== 'RequirementExtraction');
    render(<RequirementsView index={indexTrace(file)} onOpenElement={() => {}} onShowLineage={() => {}} />);
    expect(screen.getByText(/No requirements recorded yet/)).toBeTruthy();
  });
});

describe('LineageView, keyboard access', () => {
  it('lists the drawn connectors as buttons that select their link', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 10, top: 0, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) });
    render(<LineageView index={indexTrace(trace())} rootId={null} onRootChange={() => {}} onOpenElement={() => {}} />);
    const connector = screen.getByRole('button', { name: /^Library → Generated sqlalchemy/ });
    fireEvent.click(connector);
    expect(screen.getByRole('heading', { name: 'Trace link' })).toBeTruthy();
  });
});

describe('SearchableCombobox', () => {
  const items: ComboItem[] = [
    { kind: 'option', value: 'all', label: 'Whole project' },
    { kind: 'heading', key: 'models', label: 'Models', level: 1 },
    { kind: 'option', value: 'cd', label: 'Library' },
    { kind: 'option', value: 'book', label: 'Book', keywords: 'Library', indent: true },
    { kind: 'heading', key: 'code', label: 'Generated code', level: 1 },
    { kind: 'heading', key: 'run', label: 'Generated sqlalchemy', level: 2 },
    { kind: 'option', value: 'file', label: 'app/models.py', indent: true },
  ];

  it('keeps the matches under their headings', () => {
    expect(filterComboItems(items, 'models.py').map((i) => (i.kind === 'option' ? i.value : i.key))).toEqual(['code', 'run', 'file']);
    expect(filterComboItems(items, 'book').map((i) => (i.kind === 'option' ? i.value : i.key))).toEqual(['models', 'book']);
    expect(filterComboItems(items, '')).toBe(items);
  });

  it('narrows the list as one types, and chooses with the keyboard', () => {
    const onChange = vi.fn();
    render(
      <SearchableCombobox
        items={items} value="all" onChange={onChange} valueLabel="Whole project" label="Lineage of"
        searchPlaceholder="Search" emptyText="Nothing" moreText={(n) => `${n} more`}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lineage of: Whole project' }));
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'py' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['app/models.py']);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('file');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Lineage of: Whole project' }));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('cd');
    fireEvent.click(screen.getByRole('button', { name: 'Lineage of: Whole project' }));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
