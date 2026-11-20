import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../../app/store/store';
import { loadProjectThunk, updateDiagramModelThunk } from '../../../app/store/workspaceSlice';
import type { LabDone } from '../../../shared/api/lab';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { handleLabDone, labProposalChangeId } from '../labDone';
import { LabModelProposalBanner } from '../LabModelProposalBanner';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn(), update: vi.fn() },
}));
const confirm = vi.hoisted(() => ({ answer: true }));
vi.mock('../../../shared/services/confirm/globalConfirm', () => ({
  globalConfirm: vi.fn(async () => confirm.answer),
}));

const PROPOSAL: LabDone = {
  step: 'plan',
  changeId: 'c1',
  title: 'Note element',
  kind: 'metamodel',
  plan: null,
  modelProposal: {
    title: 'Note metamodel',
    diagramType: 'ClassDiagram',
    model: {
      version: '3.0.0',
      type: 'ClassDiagram',
      size: { width: 0, height: 0 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        n: { id: 'n', name: 'Note', type: 'Class', owner: null, bounds: { x: 0, y: 0, width: 160, height: 100 }, attributes: [], methods: [] },
      },
      relationships: {},
      assessments: {},
    },
  },
  repoChanges: [],
  checks: [],
  checklist: [],
  summary: '',
  stopReason: 'completed',
  finalText: '',
  report: null,
  pullRequests: [],
  cost: { usd: 0, turns: 0, elapsedSeconds: 0, runs: 0 },
  issues: [],
  noteProposals: [],
};

const BANNER_TEXT = 'The agent proposes this model for the extension';
const classDiagrams = () =>
  ProjectStorageRepository.loadProject(store.getState().workspace.project!.id)!.diagrams.ClassDiagram;

function renderBanner() {
  render(
    <Provider store={store}>
      <LabModelProposalBanner />
    </Provider>,
  );
}

beforeEach(async () => {
  localStorage.clear();
  confirm.answer = true;
  const project = ProjectStorageRepository.createNewProject('Lab', '', 'me');
  await store.dispatch(loadProjectThunk(project.id)).unwrap();
});

afterEach(cleanup);

describe('LabModelProposalBanner', () => {
  it('stays hidden on an ordinary class diagram', () => {
    renderBanner();
    expect(screen.queryByText(BANNER_TEXT)).toBeNull();
  });

  it('appears when a lab run proposes a model, with Keep and Discard', async () => {
    renderBanner();
    await act(() => handleLabDone(PROPOSAL));
    expect(screen.getByRole('region', { name: 'Proposed model' })).toBeTruthy();
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Keep/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Discard/ })).toBeTruthy();
  });

  it('Keep leaves the model in its tab and removes the banner', async () => {
    renderBanner();
    await act(() => handleLabDone(PROPOSAL));
    fireEvent.click(screen.getByRole('button', { name: /Keep/ }));
    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).toBeNull());
    const diagrams = classDiagrams();
    expect(diagrams.map((diagram) => diagram.title)).toEqual(['Class Diagram', 'Note metamodel']);
    expect(labProposalChangeId(diagrams[1])).toBeNull();
    expect(Object.keys((diagrams[1].model as { elements: object }).elements)).toEqual(['n']);
  });

  it('Discard asks first and changes nothing when the user says no', async () => {
    renderBanner();
    await act(() => handleLabDone(PROPOSAL));
    confirm.answer = false;
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    const { globalConfirm } = await import('../../../shared/services/confirm/globalConfirm');
    await waitFor(() => expect(globalConfirm).toHaveBeenCalled());
    await act(async () => undefined);
    expect(classDiagrams()).toHaveLength(2);
    expect(screen.getByText(BANNER_TEXT)).toBeTruthy();
  });

  it('offers a revision the agent made while the user was editing, and replaces the user version on request', async () => {
    renderBanner();
    await act(() => handleLabDone(PROPOSAL));
    const sent = classDiagrams()[1].model;
    const edited = structuredClone(sent) as { elements: Record<string, { name: string }> };
    edited.elements.n.name = 'Memo';
    await act(async () => {
      await store.dispatch(updateDiagramModelThunk({ model: edited as never })).unwrap();
    });
    const revision = structuredClone(PROPOSAL);
    (revision.modelProposal!.model as { elements: Record<string, { name: string }> }).elements.n.name = 'Notice';
    await act(() => handleLabDone(revision, sent));

    expect(screen.getByText('The agent revised its proposal while you were editing')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Discard/ })).toBeNull();
    const nameOnCanvas = () => (classDiagrams()[1].model as { elements: Record<string, { name: string }> }).elements.n.name;
    expect(nameOnCanvas()).toBe('Memo');

    fireEvent.click(screen.getByRole('button', { name: /Use the revision/ }));
    await waitFor(() => expect(screen.getByText(BANNER_TEXT)).toBeTruthy());
    expect(nameOnCanvas()).toBe('Notice');
  });

  it('Keep mine drops the revision and leaves the user version', async () => {
    renderBanner();
    await act(() => handleLabDone(PROPOSAL));
    const sent = classDiagrams()[1].model;
    const edited = structuredClone(sent) as { elements: Record<string, { name: string }> };
    edited.elements.n.name = 'Memo';
    await act(async () => {
      await store.dispatch(updateDiagramModelThunk({ model: edited as never })).unwrap();
    });
    await act(() => handleLabDone(structuredClone(PROPOSAL), sent));

    fireEvent.click(screen.getByRole('button', { name: /Keep mine/ }));
    await waitFor(() => expect(screen.getByText(BANNER_TEXT)).toBeTruthy());
    expect((classDiagrams()[1].model as { elements: Record<string, { name: string }> }).elements.n.name).toBe('Memo');
  });

  it("Discard closes the proposal's tab", async () => {
    renderBanner();
    await act(() => handleLabDone(PROPOSAL));
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).toBeNull());
    expect(classDiagrams().map((diagram) => diagram.title)).toEqual(['Class Diagram']);
  });
});
