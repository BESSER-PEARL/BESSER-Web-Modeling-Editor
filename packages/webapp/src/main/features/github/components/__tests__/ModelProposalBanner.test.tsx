import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PROJECT_ID = 'github_me_shop';
const loadProject = vi.fn(async () => undefined);
vi.mock('../../../../app/hooks/useProject', () => ({
  useProject: () => ({ currentProject: { id: PROJECT_ID }, loadProject }),
}));
const repo = vi.hoisted(() => ({ link: null as unknown }));
vi.mock('../../hooks/useRepoSync', () => ({ useRepoSync: () => ({ link: repo.link }) }));
const saved = vi.hoisted(() => ({ project: null as any }));
vi.mock('../../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: {
    loadProject: () => saved.project,
    saveProject: (project: unknown) => {
      saved.project = project;
    },
  },
}));

const confirm = vi.hoisted(() => ({ answer: true }));
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({
  globalConfirm: vi.fn(async () => confirm.answer),
}));

import { ModelProposalBanner } from '../ModelProposalBanner';
import { getProjectGitHubLink } from '../../../../shared/services/storage/projectGitHubLink';

const PROPOSAL = {
  stack: ['FastAPI'],
  model_source: 'SQLAlchemy models',
  source_files: ['app/models.py'],
  entities: ['Book', 'Author'],
  diagramId: 'class_bbbbbbbb',
};
const LINK = { owner: 'me', repo: 'shop', branch: 'main', baseCommitSha: 'b'.repeat(40), modelProposal: PROPOSAL };

function withProposal(proposal: Record<string, unknown> = PROPOSAL) {
  repo.link = { ...LINK, modelProposal: proposal };
  saved.project = {
    id: PROJECT_ID,
    currentDiagramIndices: { ClassDiagram: 0 },
    diagrams: {
      ClassDiagram: [{ id: 'class_bbbbbbbb', model: { type: 'ClassDiagram', elements: { a: {} }, relationships: { r: {} } } }],
    },
  };
  render(<ModelProposalBanner />);
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  loadProject.mockClear();
});

describe('ModelProposalBanner', () => {
  it('names the repo and the classes BESSER read', () => {
    withProposal();
    expect(screen.getByText(/me\/shop/)).toBeTruthy();
    expect(screen.getByText(/2 classes/)).toBeTruthy();
  });

  it('says an AI proposed the classes and that it is a reading to check', () => {
    withProposal({
      ...PROPOSAL,
      model_source: 'AI reading of the code',
      source_files: ['prisma/schema.prisma', 'src/types/order.ts', 'README.md'],
      ai: true,
    });
    expect(screen.getByText('Proposed by AI from me/shop: 2 classes')).toBeTruthy();
    expect(screen.getByText(/An AI reading of prisma\/schema\.prisma, src\/types\/order\.ts, …/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Accept model/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Discard/ })).toBeTruthy();
  });

  it('Accept keeps the model and settles the proposal, keeping the link', () => {
    withProposal();
    fireEvent.click(screen.getByRole('button', { name: /Accept model/ }));
    const link = getProjectGitHubLink(PROJECT_ID);
    expect(link).toMatchObject({ repo: 'shop', baseCommitSha: LINK.baseCommitSha });
    expect(link?.modelProposal).toBeUndefined();
    expect(Object.keys(saved.project.diagrams.ClassDiagram[0].model.elements)).toHaveLength(1);
  });

  it('Discard asks first, and keeps everything when the user says no', async () => {
    withProposal();
    confirm.answer = false;
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    const { globalConfirm } = await import('../../../../shared/services/confirm/globalConfirm');
    await waitFor(() => expect(globalConfirm).toHaveBeenCalled());
    await Promise.resolve();
    expect(loadProject).not.toHaveBeenCalled();
    expect(Object.keys(saved.project.diagrams.ClassDiagram[0].model.elements).length).toBeGreaterThan(0);
    confirm.answer = true;
  });

  it('Discard empties the class diagram but keeps the repo linked', async () => {
    withProposal();
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await waitFor(() => expect(loadProject).toHaveBeenCalledWith(PROJECT_ID));
    expect(saved.project.diagrams.ClassDiagram[0].model).toMatchObject({ elements: {}, relationships: {} });
    expect(getProjectGitHubLink(PROJECT_ID)).toMatchObject({ repo: 'shop' });
    expect(getProjectGitHubLink(PROJECT_ID)?.modelProposal).toBeUndefined();
  });

  it("Discard empties the proposal's diagram, not the class diagram the user has open", async () => {
    // Review repro: the user opened their own diagram (index 1) and Discard wiped it, keeping the proposal.
    repo.link = LINK;
    saved.project = {
      id: PROJECT_ID,
      currentDiagramIndices: { ClassDiagram: 1 },
      diagrams: {
        ClassDiagram: [
          { id: 'class_bbbbbbbb', title: 'Proposed', model: { type: 'ClassDiagram', elements: { proposed: {} }, relationships: {} } },
          { id: 'mine', title: 'My work', model: { type: 'ClassDiagram', elements: { mine: {} }, relationships: {} } },
        ],
      },
    };
    render(<ModelProposalBanner />);
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await waitFor(() => expect(loadProject).toHaveBeenCalledWith(PROJECT_ID));
    expect(Object.keys(saved.project.diagrams.ClassDiagram[0].model.elements)).toEqual([]);
    expect(Object.keys(saved.project.diagrams.ClassDiagram[1].model.elements)).toEqual(['mine']);
  });

  it('Discard of a proposal that does not name its diagram leaves every diagram as it is', async () => {
    const { diagramId: _none, ...older } = PROPOSAL;
    withProposal(older);
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await waitFor(() => expect(loadProject).toHaveBeenCalledWith(PROJECT_ID));
    expect(Object.keys(saved.project.diagrams.ClassDiagram[0].model.elements)).toEqual(['a']);
    expect(getProjectGitHubLink(PROJECT_ID)?.modelProposal).toBeUndefined();
  });
});
