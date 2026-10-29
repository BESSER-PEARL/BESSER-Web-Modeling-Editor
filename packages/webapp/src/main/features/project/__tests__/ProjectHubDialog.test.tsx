import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectHubDialog } from '../ProjectHubDialog';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../shared/types/project';

const mockLoadProject = vi.fn();
const mockCreateProject = vi.fn();
const mockImportDiagram = vi.fn();
const mockGithubLogin = vi.fn();
let mockGithubAuthenticated = false;

vi.mock('../../../app/hooks/useProject', () => ({
  useProject: () => ({
    currentProject: null,
    createProject: mockCreateProject,
    loadProject: mockLoadProject,
    deleteProject: vi.fn(),
  }),
}));
vi.mock('../../../shared/hooks/useGitHubAuth', () => ({
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
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../import/useImportDiagram', () => ({
  useImportDiagramToProject: () => mockImportDiagram,
}));
vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
}));
vi.mock('../FirstRunLanding', () => ({
  FirstRunLanding: ({ onMoreOptions }: { onMoreOptions: () => void }) => (
    <div data-testid="first-run-landing">
      <button type="button" onClick={onMoreOptions}>More options</button>
    </div>
  ),
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
  mockCreateProject.mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.success).mockReset();
  mockImportDiagram.mockReset();
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

  it('shows neutral copy and no step badge to a returning user on the start screen', () => {
    saveProject('Existing');
    render(<ProjectHubDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeTruthy();
    expect(screen.getByText('Open a recent project or start a new one.')).toBeTruthy();
    expect(screen.queryByText(/Welcome to the BESSER/)).toBeNull();
    expect(screen.queryByText(/Step \d of 2/)).toBeNull();
  });

  it('keeps the first-run title and step badge when reached from the welcome chooser', () => {
    render(<ProjectHubDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));

    expect(screen.getByRole('heading', { name: 'Welcome to the BESSER Web Modeling Editor' })).toBeTruthy();
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
  });

  it('labels the blank-start card "New Project" since it opens the mode chooser', () => {
    saveProject('Existing');
    render(<ProjectHubDialog open onOpenChange={() => {}} />);
    expect(screen.getByRole('button', { name: /^New Project/ })).toBeTruthy();
    expect(screen.queryByText('Create Blank')).toBeNull();
    expect(screen.getByRole('button', { name: /^Continue From GitHub/ })).toBeTruthy();
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

  describe('"From Data" step, SDMX source', () => {
    const providers = {
      providers: [
        { key: 'eurostat', name: 'Eurostat', baseUrl: 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1', agency: 'ESTAT' },
        { key: 'ecb', name: 'European Central Bank', baseUrl: 'https://data-api.ecb.europa.eu/service', agency: 'ECB' },
      ],
      customUrlAllowed: true,
    };
    const diagram = { title: 'UneRtM', model: { type: 'ClassDiagram', elements: {}, relationships: {} }, diagramType: 'ClassDiagram' };

    const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 502) =>
      Promise.resolve({ ok, status, statusText: '', json: () => Promise.resolve(body) } as Response);

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('keeps files as the default source and switches to the SDMX fields', async () => {
      const fetchMock = vi.fn((url: string, _init?: RequestInit) => jsonResponse(url.endsWith('/sdmx-providers') ? providers : diagram));
      vi.stubGlobal('fetch', fetchMock);
      render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="spreadsheet" />);

      expect(screen.getByTestId('data-source-files').getAttribute('aria-checked')).toBe('true');
      expect(screen.getByRole('button', { name: /create from spreadsheet/i })).toBeTruthy();
      expect(fetchMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('data-source-sdmx'));
      expect(screen.getByTestId('data-source-sdmx').getAttribute('aria-checked')).toBe('true');
      expect(screen.queryByRole('button', { name: /create from spreadsheet/i })).toBeNull();
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/sdmx-providers$/), expect.anything()),
      );
      expect(screen.getByLabelText(/^Dataflow/)).toBeTruthy();
    });

    it('enables the submit only for a valid dataflow id, then posts it and imports the diagram', async () => {
      const fetchMock = vi.fn((url: string, _init?: RequestInit) => jsonResponse(url.endsWith('/sdmx-providers') ? providers : diagram));
      vi.stubGlobal('fetch', fetchMock);
      render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="spreadsheet" />);
      fireEvent.click(screen.getByTestId('data-source-sdmx'));
      await waitFor(() => expect(screen.getByTestId('sdmx-provider').hasAttribute('disabled')).toBe(false));

      const submit = screen.getByRole('button', { name: /create from sdmx/i }) as HTMLButtonElement;
      expect(submit.disabled).toBe(true);
      const dataflow = screen.getByLabelText(/^Dataflow/) as HTMLInputElement;
      fireEvent.change(dataflow, { target: { value: '../admin' } });
      expect(submit.disabled).toBe(true);
      fireEvent.change(dataflow, { target: { value: 'une_rt_m' } });
      expect(submit.disabled).toBe(false);

      fireEvent.click(submit);
      await waitFor(() => expect(mockImportDiagram).toHaveBeenCalledTimes(1));
      const [url, init] = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/sdmx-to-domain-model')) as [string, RequestInit];
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual({ provider: 'eurostat', dataflow: 'une_rt_m' });
      expect(url).toMatch(/\/sdmx-to-domain-model$/);
      const imported = mockImportDiagram.mock.calls[0][0] as File;
      expect(imported.name).toMatch(/_class_diagram\.json$/);
    });

    it('shows an error, and no custom URL field, when the provider list cannot be loaded', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
      render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="spreadsheet" />);
      fireEvent.click(screen.getByTestId('data-source-sdmx'));

      expect((await screen.findByTestId('sdmx-providers-failed')).getAttribute('role')).toBe('alert');
      expect(screen.queryByLabelText(/^API base URL/)).toBeNull();
      expect((screen.getByRole('button', { name: /create from sdmx/i }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows the backend explanation and creates no project when the import fails', async () => {
      const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
        url.endsWith('/sdmx-providers')
          ? jsonResponse(providers)
          : jsonResponse({ detail: 'Dataflow ESTAT:nope not found at Eurostat' }, false, 404),
      );
      vi.stubGlobal('fetch', fetchMock);
      render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="spreadsheet" />);
      fireEvent.click(screen.getByTestId('data-source-sdmx'));
      await waitFor(() => expect(screen.getByTestId('sdmx-provider').hasAttribute('disabled')).toBe(false));
      fireEvent.change(screen.getByLabelText(/^Dataflow/), { target: { value: 'nope' } });
      fireEvent.click(screen.getByRole('button', { name: /create from sdmx/i }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(String(vi.mocked(toast.error).mock.calls[0][0])).toContain('Dataflow ESTAT:nope not found at Eurostat');
      expect(mockCreateProject).not.toHaveBeenCalled();
      expect(mockImportDiagram).not.toHaveBeenCalled();
    });
  });

  it('creates the project from spreadsheet files only once the diagram is back', async () => {
    const order: string[] = [];
    const diagram = { title: 'People', model: { type: 'ClassDiagram', elements: {}, relationships: {} } };
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => {
      order.push('request');
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(diagram) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);
    mockCreateProject.mockImplementation(() => {
      order.push('createProject');
      return Promise.resolve();
    });
    render(<ProjectHubDialog open onOpenChange={() => {}} initialStep="spreadsheet" />);
    const fileInput = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['name,age'], 'people.csv', { type: 'text/csv' })] } });
    fireEvent.click(screen.getByRole('button', { name: /create from spreadsheet/i }));

    await waitFor(() => expect(mockImportDiagram).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/csv-to-domain-model$/);
    expect((init.body as FormData).getAll('files')).toHaveLength(1);
    expect(order).toEqual(['request', 'createProject']);
    expect(toast.success).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
