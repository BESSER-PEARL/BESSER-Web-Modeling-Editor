import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectHubDialog } from '../ProjectHubDialog';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../shared/types/project';

const mockCreateProject = vi.fn();
const mockCapture = vi.fn();

vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({
  getPostHog: () => ({ capture: mockCapture }),
}));
vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({
    currentProject: null,
    createProject: mockCreateProject,
    loadProject: vi.fn(),
    deleteProject: vi.fn(),
  }),
}));
vi.mock('../../github/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({ isAuthenticated: false, githubSession: null, login: vi.fn() }),
}));
vi.mock('../../github/hooks/useGitHubStorage', () => ({
  useGitHubStorage: () => ({ repositories: [], isLoading: false, fetchRepositories: vi.fn(), fetchBranches: vi.fn() }),
}));
vi.mock('../../import/useImportDiagram', () => ({ useImportDiagramToProject: () => vi.fn() }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../FirstRunLanding', () => ({
  FirstRunLanding: ({ onChoose }: { onChoose: (mode: 'model' | 'agent', remember: boolean) => void }) => (
    <div data-testid="interface-chooser">
      <button type="button" onClick={() => onChoose('model', false)}>Model it</button>
      <button type="button" onClick={() => onChoose('agent', false)}>Describe it</button>
    </div>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockCreateProject.mockReset();
  mockCapture.mockReset();
  // A returning user: the chooser must come from "New project", not first run.
  ProjectStorageRepository.saveProject(createDefaultProject('Existing', '', 'me'));
});

describe('New project flow', () => {
  it('asks low-code or agentic before the project settings (File > New)', async () => {
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="create" />);
    expect(screen.getByTestId('interface-chooser')).toBeTruthy();
    expect(screen.queryByLabelText(/name/i)).toBeNull();

    fireEvent.click(screen.getByText('Describe it'));
    expect(mockCapture).toHaveBeenCalledWith('interface_chosen', {
      interface: 'agent', source: 'new_project', remembered: false,
    });
    expect(screen.queryByTestId('interface-chooser')).toBeNull();
    expect(screen.getByTestId('create-interface-agent').getAttribute('aria-checked')).toBe('true');
  });

  it('records the final interface when the project is created', async () => {
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="create" />);
    fireEvent.click(screen.getByText('Model it'));
    fireEvent.change(document.getElementById('project-name') as HTMLInputElement, { target: { value: 'Shop' } });
    // The form toggle can still flip the choice; the event reports the final one.
    fireEvent.click(screen.getByTestId('create-interface-agent'));
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    await waitFor(() => expect(mockCapture).toHaveBeenCalledWith('project_created', { interface: 'agent', via: 'form' }));
  });

  it('submits the create form on Enter in the name field', async () => {
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="create" />);
    fireEvent.click(screen.getByText('Model it'));
    const name = document.getElementById('project-name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Shop' } });
    fireEvent.submit(name.form as HTMLFormElement);
    await waitFor(() => expect(mockCreateProject).toHaveBeenCalledTimes(1));
    // Mode/perspective toggles sit inside the form and must not submit it.
    expect(screen.getByTestId('create-interface-agent').getAttribute('type')).toBe('button');
  });

  it('does not submit on Enter while the project name is invalid', () => {
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="create" />);
    fireEvent.click(screen.getByText('Model it'));
    const name = document.getElementById('project-name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.submit(name.form as HTMLFormElement);
    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});
