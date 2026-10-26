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

import { ModelProposalBanner } from '../ModelProposalBanner';
import { getProjectGitHubLink } from '../../../../shared/services/storage/projectGitHubLink';

const PROPOSAL = {
  stack: ['FastAPI'],
  model_source: 'SQLAlchemy models',
  source_files: ['app/models.py'],
  entities: ['Book', 'Author'],
};
const LINK = { owner: 'me', repo: 'shop', branch: 'main', baseCommitSha: 'b'.repeat(40), modelProposal: PROPOSAL };

function withProposal() {
  repo.link = LINK;
  saved.project = {
    id: PROJECT_ID,
    currentDiagramIndices: { ClassDiagram: 0 },
    diagrams: { ClassDiagram: [{ model: { type: 'ClassDiagram', elements: { a: {} }, relationships: { r: {} } } }] },
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

  it('Accept keeps the model and settles the proposal, keeping the link', () => {
    withProposal();
    fireEvent.click(screen.getByRole('button', { name: /Accept model/ }));
    const link = getProjectGitHubLink(PROJECT_ID);
    expect(link).toMatchObject({ repo: 'shop', baseCommitSha: LINK.baseCommitSha });
    expect(link?.modelProposal).toBeUndefined();
    expect(Object.keys(saved.project.diagrams.ClassDiagram[0].model.elements)).toHaveLength(1);
  });

  it('Discard empties the class diagram but keeps the repo linked', async () => {
    withProposal();
    fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
    await waitFor(() => expect(loadProject).toHaveBeenCalledWith(PROJECT_ID));
    expect(saved.project.diagrams.ClassDiagram[0].model).toMatchObject({ elements: {}, relationships: {} });
    expect(getProjectGitHubLink(PROJECT_ID)).toMatchObject({ repo: 'shop' });
    expect(getProjectGitHubLink(PROJECT_ID)?.modelProposal).toBeUndefined();
  });
});
