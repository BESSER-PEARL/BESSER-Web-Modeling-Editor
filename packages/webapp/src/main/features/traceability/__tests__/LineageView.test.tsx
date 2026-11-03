import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LineageView } from '../LineageView';
import { indexTrace } from '../../../shared/traceability/traceQueries';
import { emptyTraceFile } from '../../../shared/types/traceability';
import type { TraceFile } from '../../../shared/types/traceability';

const time = '2026-10-29T10:00:00.000Z';
const later = '2026-10-29T11:00:00.000Z';

/** Class Book generated into lines 2-3 of sql_alchemy.py, then renamed. */
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
      { id: 'run', type: 'CodeGeneration', status: 'SUCCEEDED', startedAt: time, endedAt: time, performedBy: ['ada'],
        toolCalls: [{ id: 'rc', toolId: 'gen', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: time, logs: [] }],
        consumes: ['cd', 'book'], produces: ['file', 'lines'] },
      { id: 'edit', type: 'Modeling', status: 'SUCCEEDED', startedAt: later, endedAt: later, performedBy: ['ada'], toolCalls: [],
        consumes: [], produces: [],
        changes: [{ id: 'ch', kind: 'UPDATED', artifactId: 'book', feature: 'name', oldValue: 'Libro', newValue: 'Book', timestamp: later }] },
    ],
    traceLinks: [{
      id: 'link', sourceId: 'book', targetId: 'lines', operationId: 'run', timestamp: time,
      evidence: [{ id: 'ev', type: 'RuleEvidence', rule: 'sql_alchemy_template.py.j2#class', timestamp: time }],
      confidence: { id: 'cf', value: 1, timestamp: time },
    }],
  };
}

// Plain DOM queries: role queries walk the accessibility tree and are slow on this large view.
const view = (file: TraceFile, rootId: string | null = null) => {
  const { container } = render(<LineageView index={indexTrace(file)} rootId={rootId} onRootChange={() => {}} onOpenElement={() => {}} />);
  const rowLabels = () => [...container.querySelectorAll('[aria-pressed] > span:first-child')].map((e) => e.textContent);
  const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;
  const labelled = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  return { container, rowLabels, button, labelled };
};

describe('LineageView', () => {
  beforeEach(() => {
    // jsdom has no layout, so give every row a size for the connectors to be measured.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 10, top: 0, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) });
  });

  it('starts with the diagrams and generation runs, and shows their parts on demand', () => {
    const { container, rowLabels, labelled } = view(trace());
    expect(rowLabels()).toEqual(['Class Diagram', 'Generated sqlalchemy']);
    expect(container.textContent).toContain('2 diagrams, prompts and generation runs, joined by 1 trace links');

    fireEvent.click(container.querySelector('[aria-pressed]')!); // clicking a card opens it
    expect(rowLabels()).toEqual(['Class Diagram', 'Book', 'Generated sqlalchemy']);
    fireEvent.click(labelled('Show the parts of Generated sqlalchemy')!);
    fireEvent.click(labelled('Show the parts of sql_alchemy.py')!);
    expect(rowLabels()).toEqual(['Class Diagram', 'Book', 'Generated sqlalchemy', 'sql_alchemy.py', 'Book · lines 2–3']);
    fireEvent.click(labelled('Hide the parts of Generated sqlalchemy')!);
    expect(rowLabels()).toEqual(['Class Diagram', 'Book', 'Generated sqlalchemy']);
  });

  it('opens the path to an element whose lineage was asked for, and explains its links', () => {
    const { container, rowLabels, button } = view(trace(), 'book');
    expect(rowLabels()).toEqual(['Class Diagram', 'Book', 'Generated sqlalchemy']);
    fireEvent.click(button('Lines 2–3')); // in the element's list of links
    expect(container.textContent).toContain('Deterministic rule: sql_alchemy_template.py.j2#class');
    expect(container.textContent).toContain('Suspect: the source changed after the link was made');
    expect(container.textContent).toContain('Renamed class Libro to Book');
  });

  it('shows the confidence of the selected link, on the canvas and in its detail', () => {
    const file = trace();
    file.operations = file.operations.filter((o) => o.id !== 'edit'); // not suspect: no pill of its own
    const { container, button } = view(file, 'book');
    expect(button('1.00')).toBeUndefined(); // a plain rule link carries no pill
    fireEvent.click(button('Lines 2–3')); // the link, from the element's list
    expect(button('1.00')).toBeTruthy();
    expect(container.querySelector('aside')!.textContent).toContain('Confidence1.00'); // the section, once
    expect(container.querySelector('aside')!.textContent).not.toContain('Confidence 1.00'); // no badge
  });

  it('fades the other links while a link is selected', () => {
    const file = trace();
    file.artifacts.push(
      { id: 'author', type: 'ModelArtifact', name: 'Author', elementId: 'c2', elementType: 'Class', parentId: 'cd', timestamp: time },
      { id: 'alines', type: 'CodeArtifact', name: 'Author (5-6)', path: 'sql_alchemy.py', contentHash: 'h3', startLine: 5, endLine: 6, parentId: 'file', timestamp: time },
    );
    file.traceLinks.push({ ...file.traceLinks[0], id: 'link2', sourceId: 'author', targetId: 'alines' });
    const { container, button } = view(file);
    fireEvent.click(button('Expand all'));
    const opacities = () => [...container.querySelectorAll('svg path[stroke-opacity]')].map((p) => Number(p.getAttribute('stroke-opacity')));
    expect(opacities().every((o) => o > 0.3)).toBe(true);
    fireEvent.click(container.querySelectorAll('svg path.cursor-pointer')[0]); // a line
    expect(opacities().filter((o) => o <= 0.15)).toHaveLength(1); // the other link
  });

  it('shows the log records an AI evidence rests on, though another operation holds them', () => {
    const file = trace();
    // As with the assistant: the messages are the conversation's, the link is the edits'.
    file.tools.push({ id: 'llm', type: 'LLM', name: 'gpt-6-luna', provider: 'openai', timestamp: time });
    file.operations.push({
      id: 'chat', type: 'Conversation', status: 'SUCCEEDED', startedAt: time, endedAt: time, performedBy: ['ada'],
      consumes: [], produces: [],
      toolCalls: [{ id: 'call', toolId: 'llm', sequenceNumber: 0, status: 'SUCCEEDED', startedAt: time, logs: [
        { id: 'l1', content: 'Add a Book class', sequenceNumber: 0, logType: 'INPUT_REQUEST', timestamp: time },
        { id: 'l2', content: 'Added the class Book.', sequenceNumber: 1, logType: 'OUTPUT_RESPONSE', timestamp: time },
      ] }],
    });
    file.traceLinks[0].evidence = [{ id: 'ev', type: 'AIEvidence', algorithm: 'gpt-6-luna', logIds: ['l1', 'l2'], timestamp: time }];
    const { container, button } = view(file, 'book');
    fireEvent.click(button('Lines 2–3'));
    const detail = container.querySelector('aside')!.textContent;
    expect(detail).toContain('AI (gpt-6-luna), based on 2 log records');
    expect(detail).toContain('UserAdd a Book class');
    expect(detail).toContain('AssistantAdded the class Book.');
  });

  it('says so when a link has no confidence', () => {
    const file = trace();
    delete file.traceLinks[0].confidence;
    const { container, button } = view(file, 'book');
    fireEvent.click(button('Lines 2–3'));
    expect(container.textContent).toContain('the operation that made this link reported no confidence');
    expect(button('–')).toBeTruthy(); // on the canvas too
  });

  it('opens a bundle of links down to their ends', () => {
    const file = trace();
    file.artifacts.push(
      { id: 'author', type: 'ModelArtifact', name: 'Author', elementId: 'c2', elementType: 'Class', parentId: 'cd', timestamp: time },
      { id: 'alines', type: 'CodeArtifact', name: 'Author (5-6)', path: 'sql_alchemy.py', contentHash: 'h3', startLine: 5, endLine: 6, parentId: 'file', timestamp: time },
    );
    file.traceLinks.push({ ...file.traceLinks[0], id: 'link2', sourceId: 'author', targetId: 'alines' });
    const { rowLabels, button } = view(file);
    fireEvent.click(button('×2'));
    expect(rowLabels()).toEqual(['Class Diagram', 'Author', 'Book', 'Generated sqlalchemy', 'sql_alchemy.py', 'Book · lines 2–3', 'Author · lines 5–6']);
    expect(button('×2')).toBeUndefined();
  });

  it('expands and collapses everything, and goes full screen', () => {
    const { container, rowLabels, button } = view(trace());
    fireEvent.click(button('Expand all'));
    expect(rowLabels()).toContain('Book · lines 2–3');
    fireEvent.click(button('Collapse all'));
    expect(rowLabels()).toEqual(['Class Diagram', 'Generated sqlalchemy']);

    fireEvent.click(button('Full screen'));
    expect(document.body.querySelector('.fixed.inset-0')).toBeTruthy(); // a portal: full screen leaves the page
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.body.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('keeps full screen when the lineage starts from another element', () => {
    // The page keeps the starting point, as TraceabilityPage does.
    const Page = () => {
      const [root, setRoot] = React.useState<string | null>(null);
      return <LineageView index={indexTrace(trace())} rootId={root} onRootChange={setRoot} onOpenElement={() => {}} />;
    };
    render(<Page />);
    const find = (selector: string, text: string) =>
      [...document.body.querySelectorAll<HTMLElement>(selector)].find((e) => e.textContent?.startsWith(text))!;
    fireEvent.click(find('button', 'Full screen'));
    fireEvent.click(find('[aria-pressed]', 'Class Diagram')); // opens it
    fireEvent.click(find('[aria-pressed]', 'Book'));
    fireEvent.click(find('button', 'Show its lineage'));
    expect(document.body.textContent).toContain('Exit full screen');
    expect(document.body.querySelector('.fixed.inset-0')).toBeTruthy();
  });

  it('zooms the canvas', () => {
    const { labelled, button } = view(trace());
    fireEvent.click(labelled('Zoom in')!);
    expect(button('125%')).toBeTruthy();
    fireEvent.click(button('125%')); // resets
    expect(button('100%')).toBeTruthy();
  });
});
