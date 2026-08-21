import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { UMLDiagramType } from '@besser/wme';
import { ProjectSettingsPanel } from '../ProjectSettingsPanel';
import { workspaceReducer } from '../../../app/store/workspaceSlice';
import { errorReducer } from '../../../app/store/errorManagementSlice';
import { createDefaultProject, BesserProject } from '../../../shared/types/project';
import { perspectivesFromDiagramList } from '../../../shared/perspectives';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockUpdateProject = vi.fn();
const mockExportProject = vi.fn();

vi.mock('../../../app/hooks/useProject', () => ({
  useProject: vi.fn(),
}));

vi.mock('@besser/wme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@besser/wme')>();
  return {
    ...actual,
    settingsService: {
      shouldShowInstancedObjects: vi.fn(() => false),
      shouldShowAssociationNames: vi.fn(() => false),
      shouldUsePropertiesPanel: vi.fn(() => false),
      getClassNotation: vi.fn(() => 'UML'),
      updateSetting: vi.fn(),
    },
  };
});

vi.mock('../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: {
    withoutNotify: (fn: () => void) => fn(),
    saveProject: vi.fn(),
    getCurrentProject: vi.fn(() => null),
  },
}));

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { useProject } from '../../../app/hooks/useProject';

const mockUseProject = vi.mocked(useProject);

const setupUseProject = (overrides: Partial<ReturnType<typeof useProject>> = {}) => {
  mockUseProject.mockReturnValue({
    currentProject: null,
    currentDiagram: undefined as any,
    currentDiagramType: 'ClassDiagram',
    loading: false,
    error: null,
    createProject: vi.fn(),
    loadProject: vi.fn(),
    switchDiagramType: vi.fn(),
    updateCurrentDiagram: vi.fn(),
    clearProjectError: vi.fn(),
    updateProject: mockUpdateProject,
    getAllProjects: vi.fn(() => []),
    deleteProject: vi.fn(),
    exportProject: mockExportProject,
    ...overrides,
  });
};

const buildStore = (project: BesserProject | null) =>
  configureStore({
    reducer: { workspace: workspaceReducer, errors: errorReducer },
    preloadedState: project
      ? {
          workspace: {
            project,
            activeDiagramType: project.currentDiagramType,
            activeDiagramIndex: project.currentDiagramIndices[project.currentDiagramType] ?? 0,
            activeDiagram: project.diagrams[project.currentDiagramType][0] ?? null,
            editorOptions: { type: UMLDiagramType.ClassDiagram, locale: 'en' as any },
            editorRevision: 0,
            loading: false,
            error: null,
          } as any,
        }
      : undefined,
  });

const renderWithStore = (project: BesserProject | null) => {
  const store = buildStore(project);
  return render(
    <Provider store={store}>
      <ProjectSettingsPanel />
    </Provider>,
  );
};

const createProjectWithContent = (): BesserProject => {
  const project = createDefaultProject('My Project', 'A test project', 'alice');
  project.diagrams.ClassDiagram[0].model = {
    version: '3.0.0' as const,
    type: UMLDiagramType.ClassDiagram,
    size: { width: 1400, height: 740 },
    elements: { 'element-1': { id: 'element-1', type: 'Class', name: 'User' } as any },
    relationships: {},
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  };
  return project;
};

// ── Tests ────────────────────────────────────────────────────────────────

describe('ProjectSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    setupUseProject({ loading: true });
    renderWithStore(null);
    expect(screen.getByText('Loading project...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    setupUseProject({ error: 'Something went wrong' });
    renderWithStore(null);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders "no project" state when currentProject is null', () => {
    setupUseProject({ currentProject: null });
    renderWithStore(null);
    expect(screen.getByText('Open or create a project to edit settings.')).toBeInTheDocument();
  });

  it('renders General, Diagrams, Display, and Modeling Perspectives cards', () => {
    const project = createDefaultProject('Test Project', 'desc', 'owner');
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Diagrams')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
    expect(screen.getByText('Modeling Perspectives')).toBeInTheDocument();
  });

  it('renders quick presets row', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    expect(screen.getByText('Quick presets')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-preset-data')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-preset-agent')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-preset-fullApp')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-preset-quantum')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-preset-all')).toBeInTheDocument();
  });

  it('renders one toggle per supported diagram type', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    expect(screen.getByTestId('perspective-toggle-ClassDiagram')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-toggle-ObjectDiagram')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-toggle-StateMachineDiagram')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-toggle-AgentDiagram')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-toggle-UserDiagram')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-toggle-GUINoCodeDiagram')).toBeInTheDocument();
    expect(screen.getByTestId('perspective-toggle-QuantumCircuitDiagram')).toBeInTheDocument();
  });

  it('marks the "Show All" preset active when every perspective is enabled', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    expect(screen.getByTestId('perspective-preset-all')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('perspective-preset-data')).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the matching preset active when perspectives match a preset', () => {
    const project = createDefaultProject('Test', '', 'owner');
    project.settings.perspectives = perspectivesFromDiagramList(['ClassDiagram', 'ObjectDiagram']);
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    expect(screen.getByTestId('perspective-preset-data')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('perspective-preset-all')).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables the only remaining enabled toggle (last-enabled guard)', () => {
    const project = createDefaultProject('Test', '', 'owner');
    project.settings.perspectives = perspectivesFromDiagramList(['ClassDiagram']);
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    const classToggle = screen.getByTestId('perspective-toggle-ClassDiagram') as HTMLInputElement;
    expect(classToggle).toBeDisabled();
    expect(classToggle).toBeChecked();
  });

  it('renders project name in the input field', () => {
    const project = createDefaultProject('My Cool Project', 'desc', 'owner');
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    expect(screen.getByDisplayValue('My Cool Project')).toBeInTheDocument();
  });

  it('calls updateProject when project name is changed', () => {
    const project = createDefaultProject('Old Name', 'desc', 'owner');
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    fireEvent.change(screen.getByDisplayValue('Old Name'), { target: { value: 'New Name' } });
    expect(mockUpdateProject).toHaveBeenCalledWith({ name: 'New Name' });
  });

  it('only shows diagrams with content, filtering empty ones', () => {
    const project = createProjectWithContent();
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    // "Class Diagram" appears both as a perspective label and as the diagram
    // title — assert on the unique count line in the Diagrams card instead.
    expect(screen.getByText('1 diagram with content')).toBeInTheDocument();
    expect(screen.getAllByText('Class Diagram').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "No diagrams with content yet" when all are empty', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    renderWithStore(project);

    expect(screen.getByText('No diagrams with content yet')).toBeInTheDocument();
  });

  it('shows the Export Project button', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    renderWithStore(project);
    expect(screen.getByText('Export Project')).toBeInTheDocument();
  });
});
