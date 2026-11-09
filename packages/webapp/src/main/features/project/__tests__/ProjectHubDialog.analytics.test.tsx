/**
 * Every way the hub creates, opens or deletes a project sends its success event, and
 * every failure exit its failure event, with content-free properties only.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectHubDialog } from '../ProjectHubDialog';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../shared/types/project';

const mockCapture = vi.fn();
const mockLoadProject = vi.fn();
const mockCreateProject = vi.fn();
const mockDeleteProject = vi.fn();
const mockImportDiagram = vi.fn();
const mockImportProject = vi.fn();

vi.mock('../../../shared/services/analytics/lazy-analytics', () => ({
  captureEvent: (...args: unknown[]) => mockCapture(...args),
  getSentry: () => null,
}));
vi.mock('../../../shared/services/project-import/projectImport', () => ({
  importProject: (...args: unknown[]) => mockImportProject(...args),
}));
vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({
    currentProject: null,
    createProject: mockCreateProject,
    loadProject: mockLoadProject,
    deleteProject: mockDeleteProject,
  }),
}));
vi.mock('../../../shared/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({ isAuthenticated: false, githubSession: null, login: vi.fn() }),
}));
vi.mock('../../github/hooks/useGitHubStorage', () => ({
  useGitHubStorage: () => ({ repositories: [], isLoading: false, fetchRepositories: vi.fn(), fetchBranches: vi.fn() }),
}));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn(), loading: vi.fn(), update: vi.fn() },
}));
vi.mock('../../import/useImportDiagram', () => ({ useImportDiagramToProject: () => mockImportDiagram }));
vi.mock('../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../FirstRunLanding', () => ({
  FirstRunLanding: ({ onChoose }: { onChoose: (mode: 'model' | 'agent', remember: boolean) => void }) => (
    <button type="button" onClick={() => onChoose('model', false)}>Model it</button>
  ),
}));

const events = (name: string) => mockCapture.mock.calls.filter(([event]) => event === name).map(([, props]) => props);

const saveProject = (name: string) => {
  const project = createDefaultProject(name, '', 'me');
  ProjectStorageRepository.saveProject(project);
  return project;
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  [mockCapture, mockLoadProject, mockCreateProject, mockDeleteProject, mockImportDiagram, mockImportProject].forEach((fn) =>
    fn.mockReset(),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('project creation', () => {
  const fillCreateForm = () => {
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="create" />);
    fireEvent.click(screen.getByText('Model it'));
    fireEvent.change(document.getElementById('project-name') as HTMLInputElement, { target: { value: 'Shop' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
  };

  it('reports a failed form creation with the error kind only', async () => {
    saveProject('Existing');
    mockCreateProject.mockRejectedValue(new Error('disk full for "Shop"'));
    fillCreateForm();
    await waitFor(() => expect(events('project_creation_failed')).toHaveLength(1));
    expect(events('project_creation_failed')[0]).toEqual({
      via: 'form',
      reason: 'exception',
      error_type: 'Error',
      network_error: false,
    });
    expect(events('project_created')).toHaveLength(0);
  });

  it('counts a spreadsheet project only once its diagram is imported', async () => {
    const diagram = { title: 'People', model: { type: 'ClassDiagram', elements: {}, relationships: {} } };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(diagram) } as Response)));
    mockCreateProject.mockResolvedValue(undefined);
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="spreadsheet" />);
    const fileInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['name,age'], 'people.csv', { type: 'text/csv' })] } });
    fireEvent.click(screen.getByRole('button', { name: /create from spreadsheet/i }));
    await waitFor(() => expect(events('project_created')).toEqual([{ interface: 'model', via: 'spreadsheet' }]));
  });

  it('tells a failed spreadsheet request apart from a failed import', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 422, json: () => Promise.resolve({ detail: 'bad sheet' }) } as Response)));
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="spreadsheet" />);
    const fileInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'people.csv', { type: 'text/csv' })] } });
    fireEvent.click(screen.getByRole('button', { name: /create from spreadsheet/i }));
    await waitFor(() => expect(events('project_creation_failed')).toHaveLength(1));
    expect(events('project_creation_failed')[0]).toMatchObject({ via: 'spreadsheet', reason: 'request' });
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it('counts an imported project file, and reports an import that fails', async () => {
    const imported = createDefaultProject('Imported', '', 'me');
    mockImportProject.mockResolvedValueOnce(imported).mockRejectedValueOnce(new TypeError('bad json'));
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="open" />);
    const input = document.querySelector('input[type="file"][accept=".json,.py"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(['{}'], 'shop.json', { type: 'application/json' })] } });
    await waitFor(() => expect(events('project_created')).toEqual([{ interface: 'model', via: 'file_import' }]));

    fireEvent.change(input, { target: { files: [new File(['{'], 'shop.json', { type: 'application/json' })] } });
    await waitFor(() =>
      expect(events('project_creation_failed')).toEqual([
        { via: 'file_import', reason: 'exception', error_type: 'TypeError', network_error: false },
      ]),
    );
  });
});

describe('opening and deleting', () => {
  it('reports an opened project, and one that fails to load', async () => {
    const project = saveProject('Shop');
    mockLoadProject.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('corrupt'));
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="open" />);

    fireEvent.click(screen.getByRole('button', { name: project.name }));
    await waitFor(() => expect(events('project_opened')).toEqual([{ source: 'hub' }]));

    fireEvent.click(screen.getByRole('button', { name: project.name }));
    await waitFor(() =>
      expect(events('project_open_failed')).toEqual([{ source: 'hub', error_type: 'Error', network_error: false }]),
    );
  });

  it('reports a deleted project with the count left, never its name', async () => {
    const doomed = saveProject('Doomed');
    saveProject('Kept');
    mockDeleteProject.mockImplementation(async (id: string) => ProjectStorageRepository.deleteProject(id));
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="open" />);

    fireEvent.click(screen.getByRole('button', { name: `Delete project ${doomed.name}` }));
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(events('project_deleted')).toEqual([{ remaining_projects: 1 }]));
  });
});
