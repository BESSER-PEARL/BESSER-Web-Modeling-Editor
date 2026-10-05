import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectHubDialog } from '../ProjectHubDialog';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../shared/types/project';

const mockLoadProject = vi.fn();
const mockGithubLogin = vi.fn();
let mockGithubAuthenticated = false;

vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({
    currentProject: null,
    createProject: vi.fn(),
    loadProject: mockLoadProject,
    deleteProject: vi.fn(),
  }),
}));
vi.mock('../../github/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({
    isAuthenticated: mockGithubAuthenticated,
    githubSession: mockGithubAuthenticated ? 'session' : null,
    login: mockGithubLogin,
  }),
}));
vi.mock('../../github/hooks/useGitHubStorage', () => ({
  useGitHubStorage: () => ({
    repositories: [],
    isLoading: false,
    fetchRepositories: vi.fn(),
    fetchBranches: vi.fn(),
  }),
}));
vi.mock('../../import/useImportDiagram', () => ({
  useImportDiagramToProject: () => vi.fn(),
}));
vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
}));
vi.mock('../FirstRunLanding', () => ({
  FirstRunLanding: () => <div data-testid="first-run-landing" />,
}));

function saveProject(name: string) {
  const project = createDefaultProject(name, '', 'me');
  ProjectStorageRepository.saveProject(project);
  return project;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockLoadProject.mockReset();
  mockGithubLogin.mockReset();
  mockGithubAuthenticated = false;
});

describe('ProjectHubDialog', () => {
  it('shows the first-run landing only when no project has ever been saved', () => {
    const { unmount } = render(<ProjectHubDialog open onOpenChange={() => {}} />);
    expect(screen.getByTestId('first-run-landing')).toBeTruthy();
    unmount();

    saveProject('Existing');
    render(<ProjectHubDialog open onOpenChange={() => {}} />);
    expect(screen.queryByTestId('first-run-landing')).toBeNull();
  });

  it('offers a GitHub sign-in on File > From GitHub when not connected', () => {
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="github" />);

    fireEvent.click(screen.getByRole('button', { name: /connect github/i }));
    expect(mockGithubLogin).toHaveBeenCalledTimes(1);
  });

  it('Enter on a project card delete button does not open the project', () => {
    const project = saveProject('Doomed');
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="open" />);

    const deleteButton = screen.getByRole('button', { name: `Delete project ${project.name}` });
    fireEvent.keyDown(deleteButton, { key: 'Enter' });

    expect(mockLoadProject).not.toHaveBeenCalled();
  });

  it('project card body is a real button that opens the project, with delete as a sibling', () => {
    const project = saveProject('Shop');
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="open" />);

    const openButton = screen.getByRole('button', { name: project.name });
    const deleteButton = screen.getByRole('button', { name: `Delete project ${project.name}` });
    expect(openButton.tagName).toBe('BUTTON');
    expect(openButton.contains(deleteButton)).toBe(false);
    expect(deleteButton.closest('[role="button"]')).toBeNull();

    fireEvent.click(openButton);
    expect(mockLoadProject).toHaveBeenCalledWith(project.id);
  });

  it('disables "create from spreadsheet" until a file is selected', () => {
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="spreadsheet" />);
    const submit = screen.getByRole('button', { name: /create from spreadsheet/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const fileInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    const file = new File(['name,age'], 'people.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(submit.disabled).toBe(false);
  });
});
