import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ project: null as unknown }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: state.project }) }));

import { AgentChangeBanner, AgentChangeLayer } from '../AgentChangeLayer';
import { CHANGE_COLORS } from '../../../../shared/components/model-marks/ModelMarks';
import { recordAgentIteration } from '../../../../shared/services/agentChanges/agentChanges';
import { readAgentChanges } from '../../../../shared/services/storage/agentChangeMarks';

const PROJECT_ID = 'p1';
const DIAGRAM_ID = 'cd1';
const bounds = (x: number) => ({ x, y: 0, width: 100, height: 60 });

const model = (elements: Record<string, Record<string, unknown>>) => ({
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 0, height: 0 },
  interactive: { elements: {}, relationships: {} },
  elements,
  relationships: {},
  assessments: {},
});

const BOOK = { id: 'c1', type: 'Class', name: 'Book', owner: null, bounds: bounds(0), attributes: ['a1'] };
const TITLE = { id: 'a1', type: 'ClassAttribute', name: '+ title: str', owner: 'c1', bounds: bounds(0) };
const LOAN = { id: 'c2', type: 'Class', name: 'Loan', owner: null, bounds: bounds(200) };
const MEMBER = { id: 'c3', type: 'Class', name: 'Member', owner: null, bounds: bounds(400) };

const BEFORE = model({ c1: BOOK, a1: TITLE, c2: LOAN });
const AFTER = model({ c1: BOOK, a1: { ...TITLE, name: '+ title: int' }, c3: MEMBER });

const project = (diagramModel: unknown, currentDiagramType = 'ClassDiagram') => ({
  id: PROJECT_ID,
  currentDiagramType,
  currentDiagramIndices: { ClassDiagram: 0 },
  diagrams: { ClassDiagram: [{ id: DIAGRAM_ID, model: diagramModel }] },
});

const renderBoth = () =>
  render(
    <>
      <AgentChangeLayer />
      <AgentChangeBanner />
    </>,
  );

let canvas: HTMLElement;

beforeEach(() => {
  localStorage.clear();
  canvas = document.createElement('div');
  canvas.innerHTML = ['c1', 'a1', 'c3'].map((id) => `<div data-id="${id}">${id}</div>`).join('');
  document.body.appendChild(canvas);
  // jsdom lays nothing out: give the reference class a size, so a ghost can be placed.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 100, bottom: 60, width: 100, height: 60, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  canvas.remove();
  vi.restoreAllMocks();
});

describe('AgentChangeLayer', () => {
  it('marks what the assistant added, modified and deleted, and lists it', async () => {
    recordAgentIteration(PROJECT_ID, DIAGRAM_ID, BEFORE, AFTER);
    state.project = project(AFTER);

    renderBoth();

    await waitFor(() => expect(screen.getByTestId('agent-added-element')).toBeTruthy());
    expect(screen.getByTestId('agent-added-element').style.boxShadow).toContain(CHANGE_COLORS.added);
    expect(screen.getByTestId('agent-modified-element').style.boxShadow).toContain(CHANGE_COLORS.modified);
    await waitFor(() => expect(screen.getByTestId('agent-deleted-element')).toBeTruthy());
    expect(screen.getByTestId('agent-deleted-element').style.borderColor).toBeTruthy();

    const banner = screen.getByRole('region');
    expect(banner.textContent).toContain('Added: Member');
    expect(banner.textContent).toContain('Changed: Book.title');
    expect(banner.textContent).toContain('Removed: Loan');
  });

  it('clears the marks and leaves the model alone', async () => {
    recordAgentIteration(PROJECT_ID, DIAGRAM_ID, BEFORE, AFTER);
    const current = project(AFTER);
    state.project = current;
    const before = JSON.stringify(current);

    renderBoth();
    fireEvent.click(screen.getByRole('button', { name: /clear marks/i }));

    expect(readAgentChanges(PROJECT_ID, DIAGRAM_ID)).toEqual([]);
    await waitFor(() => expect(screen.queryByRole('region')).toBeNull());
    expect(screen.queryByTestId('agent-added-element')).toBeNull();
    expect(JSON.stringify(current)).toBe(before);
  });

  it('draws an older edit fainter than the newest', async () => {
    const middle = model({ c1: BOOK, a1: TITLE, c3: MEMBER });
    recordAgentIteration(PROJECT_ID, DIAGRAM_ID, model({ c1: BOOK, a1: TITLE }), middle);
    recordAgentIteration(PROJECT_ID, DIAGRAM_ID, middle, model({ c1: { ...BOOK, name: 'Novel' }, a1: TITLE, c3: MEMBER }));
    state.project = project(model({ c1: { ...BOOK, name: 'Novel' }, a1: TITLE, c3: MEMBER }));

    renderBoth();

    await waitFor(() => expect(screen.getByTestId('agent-added-element')).toBeTruthy());
    const opacity = (testId: string) => Number((screen.getByTestId(testId).parentElement as HTMLElement).style.opacity);
    expect(opacity('agent-modified-element')).toBe(1);
    expect(opacity('agent-added-element')).toBeLessThan(1);
    expect(screen.getByRole('region').textContent).toContain('Earlier assistant edits');
  });

  it('follows new marks as they are recorded, and draws nothing on a diagram it did not change', async () => {
    state.project = project(AFTER);
    renderBoth();
    expect(screen.queryByRole('region')).toBeNull();

    act(() => recordAgentIteration(PROJECT_ID, DIAGRAM_ID, BEFORE, AFTER));
    await waitFor(() => expect(screen.getByRole('region')).toBeTruthy());
  });

  it('drops the mark of an element that is gone since', () => {
    recordAgentIteration(PROJECT_ID, DIAGRAM_ID, model({ c1: BOOK }), model({ c1: BOOK, c3: MEMBER }));
    state.project = project(model({ c1: BOOK }));

    renderBoth();

    expect(screen.queryByTestId('agent-added-element')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });
});
