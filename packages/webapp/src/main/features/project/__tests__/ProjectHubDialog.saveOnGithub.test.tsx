import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectHubDialog } from '../ProjectHubDialog';
import { saveProjectOnGithub } from '../saveProjectOnGithub';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject, type BesserProject } from '../../../shared/types/project';
import { getProjectGitHubLink } from '../../../shared/services/storage/projectGitHubLink';
import { sessionStorageContinueFromGithubIntent } from '../../../shared/constants/constant';
import { importProject } from '../../../shared/services/project-import/projectImport';

const mockCreateProject = vi.fn();
const mockGithubLogin = vi.fn();
let mockGithubAuthenticated = false;

vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({
    currentProject: null,
    createProject: mockCreateProject,
    loadProject: vi.fn(),
    deleteProject: vi.fn(),
  }),
}));
vi.mock('../../github/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({
    isAuthenticated: mockGithubAuthenticated,
    username: mockGithubAuthenticated ? 'octocat' : null,
    githubSession: mockGithubAuthenticated ? 'session' : null,
    login: mockGithubLogin,
  }),
}));
vi.mock('../saveProjectOnGithub', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../saveProjectOnGithub')>()),
  saveProjectOnGithub: vi.fn(),
}));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn(), loading: vi.fn(() => 'toast-id'), update: vi.fn() },
}));
vi.mock('../../github/components/RepoBrowser', () => ({ RepoBrowser: () => <div data-testid="repo-browser" /> }));
vi.mock('../../import/useImportDiagram', () => ({ useImportDiagramToProject: () => vi.fn() }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../../shared/services/project-import/projectImport', () => ({ importProject: vi.fn() }));

const createdProject = (): BesserProject => {
  const project = createDefaultProject('Shop', 'A shop', 'me');
  ProjectStorageRepository.saveProject(project);
  return project;
};

/** File > New > Model it, then the create form with the name "Shop". */
const openCreateForm = (mode: 'Model it' | 'Describe it' = 'Model it') => {
  const view = render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="create" />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(mode) }));
  fireEvent.change(document.getElementById('project-name') as HTMLInputElement, { target: { value: 'Shop' } });
  return view;
};

const submit = () => fireEvent.submit((document.getElementById('project-name') as HTMLInputElement).form as HTMLFormElement);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockCreateProject.mockReset();
  mockGithubLogin.mockReset();
  vi.mocked(saveProjectOnGithub).mockReset();
  vi.mocked(toast.update).mockReset();
  vi.mocked(toast.success).mockReset();
  mockGithubAuthenticated = false;
});

describe('Save it on GitHub', () => {
  it('is ticked by default when signed in and names the private repository', () => {
    mockGithubAuthenticated = true;
    openCreateForm();

    const box = screen.getByTestId('create-save-github') as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(screen.getByText('shop').tagName).toBe('CODE');
    expect(screen.getByText(/A private repository named/)).toBeTruthy();
  });

  it('is offered in the Agentic view too', () => {
    mockGithubAuthenticated = true;
    openCreateForm('Describe it');
    expect(screen.getByTestId('create-save-github')).toBeTruthy();
  });

  it('creates the project, then the repository, and reports where it went', async () => {
    mockGithubAuthenticated = true;
    const project = createdProject();
    mockCreateProject.mockResolvedValue(project);
    vi.mocked(saveProjectOnGithub).mockResolvedValue({ owner: 'octocat', repo: 'shop', branch: 'main' });
    const onOpenChange = vi.fn();
    render(<ProjectHubDialog open onOpenChange={onOpenChange} initialStep="create" />);
    fireEvent.click(screen.getByRole('button', { name: /Model it/ }));
    submit();

    await waitFor(() => expect(saveProjectOnGithub).toHaveBeenCalledWith('session', expect.objectContaining({ id: project.id })));
    expect(mockCreateProject).toHaveBeenCalledTimes(1);
    // No project was open: the hub closes itself, since the bootstrap keeps it open after a sign-in.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(toast.update).toHaveBeenCalledWith('toast-id', expect.objectContaining({
      type: 'success', render: 'Saved on GitHub as octocat/shop.',
    })));
  });

  it('keeps the project when the repository cannot be created', async () => {
    mockGithubAuthenticated = true;
    const project = createdProject();
    mockCreateProject.mockResolvedValue(project);
    vi.mocked(saveProjectOnGithub).mockRejectedValue(new Error('An internal error occurred while creating the repository.'));
    openCreateForm();
    submit();

    await waitFor(() => expect(toast.update).toHaveBeenCalledWith('toast-id', expect.objectContaining({
      type: 'error',
      render: 'Your project was created, but saving it on GitHub failed: An internal error occurred while creating the repository.',
    })));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Shop'));
    expect(ProjectStorageRepository.loadProject(project.id)).not.toBeNull();
    expect(getProjectGitHubLink(project.id)).toBeNull();
  });

  it('creates no repository when unticked', async () => {
    mockGithubAuthenticated = true;
    mockCreateProject.mockResolvedValue(createdProject());
    openCreateForm();
    fireEvent.click(screen.getByTestId('create-save-github'));
    submit();

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    expect(saveProjectOnGithub).not.toHaveBeenCalled();
  });

  it('offers a connect link when signed out and never touches GitHub on create', async () => {
    mockCreateProject.mockResolvedValue(createdProject());
    openCreateForm();
    expect(screen.queryByTestId('create-save-github')).toBeNull();
    expect(screen.getByTestId('create-github-connect')).toBeTruthy();
    submit();

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    expect(saveProjectOnGithub).not.toHaveBeenCalled();
  });

  it('comes back to the filled-in form, ticked, after connecting', () => {
    const first = openCreateForm('Describe it');
    fireEvent.click(screen.getByTestId('create-github-connect'));
    expect(mockGithubLogin).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(sessionStorageContinueFromGithubIntent)).not.toBeNull();
    first.unmount();

    // The OAuth redirect reloads the app; the hub reopens signed in.
    mockGithubAuthenticated = true;
    render(<ProjectHubDialog open onOpenChange={() => {}} />);

    expect((document.getElementById('project-name') as HTMLInputElement).value).toBe('Shop');
    expect(screen.getByTestId('create-interface-agent').getAttribute('aria-checked')).toBe('true');
    expect((screen.getByTestId('create-save-github') as HTMLInputElement).checked).toBe(true);
    expect(sessionStorage.getItem(sessionStorageContinueFromGithubIntent)).toBeNull();
  });
});

describe('Landing GitHub row', () => {
  it('returns to the landing after connecting from it', () => {
    const first = render(<ProjectHubDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    expect(mockGithubLogin).toHaveBeenCalledTimes(1);
    first.unmount();

    // A returning user with a saved project would normally see the start screen.
    ProjectStorageRepository.saveProject(createDefaultProject('Existing', '', 'me'));
    mockGithubAuthenticated = true;
    render(<ProjectHubDialog open onOpenChange={() => {}} />);

    expect(screen.getByText('Connected as octocat')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /How do you want to/ })).toBeTruthy();
  });

  // After a sign-in the bootstrap keeps the hub open when a project appears,
  // so on first run the hub must close itself once a project is imported.
  it('closes itself after importing a project when no project was open', async () => {
    const project = createdProject();
    vi.mocked(importProject).mockResolvedValue(project);
    const onOpenChange = vi.fn();
    const { container } = render(<ProjectHubDialog open onOpenChange={onOpenChange} />);
    const input = container.ownerDocument.querySelector('input[type="file"][accept=".json,.py"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['{}'], 'shop.json', { type: 'application/json' })] } });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('still resumes "Continue from GitHub" on the repo picker', () => {
    sessionStorage.setItem(sessionStorageContinueFromGithubIntent, '1');
    ProjectStorageRepository.saveProject(createDefaultProject('Existing', '', 'me'));
    mockGithubAuthenticated = true;
    render(<ProjectHubDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Continue From GitHub' })).toBeTruthy();
    expect(sessionStorage.getItem(sessionStorageContinueFromGithubIntent)).toBeNull();
  });
});
