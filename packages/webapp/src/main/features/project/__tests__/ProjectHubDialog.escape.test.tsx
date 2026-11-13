import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectHubDialog } from '../ProjectHubDialog';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../shared/types/project';

const openProject = createDefaultProject('Open', '', 'me');

vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({ currentProject: openProject, createProject: vi.fn(), loadProject: vi.fn(), deleteProject: vi.fn() }),
}));
vi.mock('../../github/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({ isAuthenticated: false, githubSession: null, login: vi.fn() }),
}));
vi.mock('../../github/hooks/useGitHubStorage', () => ({
  useGitHubStorage: () => ({ repositories: [], isLoading: false, fetchRepositories: vi.fn(), fetchBranches: vi.fn() }),
}));
vi.mock('../../import/useImportDiagram', () => ({ useImportDiagramToProject: () => vi.fn() }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  ProjectStorageRepository.saveProject(openProject);
});

// Live report: Escape on the project hub needed two presses. The dialog put its
// initial focus on the header's Language button, whose tooltip opens on focus
// and swallowed the first Escape.
describe('ProjectHubDialog Escape', () => {
  it('does not open the Language tooltip on open, so one Escape closes the hub', () => {
    const onOpenChange = vi.fn();
    render(<ProjectHubDialog open onOpenChange={onOpenChange} />);

    const language = screen.getByRole('button', { name: /language/i });
    expect(document.activeElement).not.toBe(language);
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
