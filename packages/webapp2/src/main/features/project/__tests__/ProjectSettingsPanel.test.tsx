import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UMLDiagramType } from '@besser/wme';
import { ProjectSettingsPanel } from '../ProjectSettingsPanel';
import { createDefaultProject, BesserProject } from '../../../shared/types/project';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockUpdateProject = vi.fn();
const mockExportProject = vi.fn();

// Mock the useProject hook
vi.mock('../../../app/hooks/useProject', () => ({
  useProject: vi.fn(),
}));

// Mock settingsService from @besser/wme
vi.mock('@besser/wme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@besser/wme')>();
  return {
    ...actual,
    settingsService: {
      shouldShowInstancedObjects: vi.fn(() => false),
      shouldShowAssociationNames: vi.fn(() => false),
      shouldUsePropertiesPanel: vi.fn(() => false),
      getClassNotation: vi.fn(() => 'UML'),
      getEnabledPerspectives: vi.fn(() => ({
        dataModeling: true,
        database: true,
        webApplication: true,
        agent: true,
        stateMachine: true,
        userModeling: true,
        quantum: true,
      })),
      setPerspectiveEnabled: vi.fn(),
      updateSetting: vi.fn(),
    },
  };
});

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { useProject } from '../../../app/hooks/useProject';

const mockUseProject = vi.mocked(useProject);

/** Helper to set up the useProject mock with common defaults. */
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

/** Create a project with a ClassDiagram that has content. */
const createProjectWithContent = (): BesserProject => {
  const project = createDefaultProject('My Project', 'A test project', 'alice');

  // Add content to ClassDiagram so it shows in the diagrams list
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
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('Loading project...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    setupUseProject({ error: 'Something went wrong' });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders "no project" state when currentProject is null', () => {
    setupUseProject({ currentProject: null });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('Open or create a project to edit settings.')).toBeInTheDocument();
  });

  it('renders two-column layout with General and Diagrams cards', () => {
    const project = createDefaultProject('Test Project', 'desc', 'owner');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Diagrams')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
  });

  it('renders the page header with project settings title', () => {
    const project = createDefaultProject('Test Project', 'desc', 'owner');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('Project Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage metadata, diagrams, and display preferences')).toBeInTheDocument();
  });

  it('only shows diagrams with content, filtering empty ones', () => {
    const project = createProjectWithContent();
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    // The ClassDiagram has content, so its title should appear in the diagrams list
    expect(screen.getByText('Class Diagram')).toBeInTheDocument();
    expect(screen.getByText('1 diagram with content')).toBeInTheDocument();
  });

  it('shows "No diagrams with content yet" when all are empty', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('No diagrams with content yet')).toBeInTheDocument();
    expect(screen.getByText('Start editing a diagram to see it here')).toBeInTheDocument();
  });

  it('renders display settings with checkboxes', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('Show Instanced Objects')).toBeInTheDocument();
    expect(screen.getByText('Show Association Names')).toBeInTheDocument();
    expect(screen.getByText('Properties Panel')).toBeInTheDocument();

    // 3 display toggles (off by default in this mock) + 7 perspective toggles (on by default)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(10);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
  });

  it('renders the Modeling Perspectives card with one toggle per use-case perspective', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('Modeling Perspectives')).toBeInTheDocument();
    expect(screen.getByText('Data Modeling')).toBeInTheDocument();
    expect(screen.getByText('Database Modeling')).toBeInTheDocument();
    expect(screen.getByText('Web Applications')).toBeInTheDocument();
    expect(screen.getByText('Agent Modeling')).toBeInTheDocument();
    expect(screen.getByText('State Machines')).toBeInTheDocument();
    expect(screen.getByText('User Modeling')).toBeInTheDocument();
    expect(screen.getByText('Quantum Computing')).toBeInTheDocument();
  });

  it('renders project name in the input field', () => {
    const project = createDefaultProject('My Cool Project', 'desc', 'owner');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    const nameInput = screen.getByDisplayValue('My Cool Project');
    expect(nameInput).toBeInTheDocument();
  });

  it('calls updateProject when project name is changed', () => {
    const project = createDefaultProject('Old Name', 'desc', 'owner');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    const nameInput = screen.getByDisplayValue('Old Name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    expect(mockUpdateProject).toHaveBeenCalledWith({ name: 'New Name' });
  });

  it('shows the Export Project button', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('Export Project')).toBeInTheDocument();
  });

  it('renders project owner and description fields', () => {
    const project = createDefaultProject('Test', 'My description', 'alice');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    expect(screen.getByDisplayValue('alice')).toBeInTheDocument();
    expect(screen.getByDisplayValue('My description')).toBeInTheDocument();
  });

  it('shows active editor info card', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('Active Editor')).toBeInTheDocument();
    // currentDiagramType is 'ClassDiagram', which gets 'Diagram' stripped -> 'Class'
    expect(screen.getByText('Class')).toBeInTheDocument();
  });

  it('renders correct diagram count when multiple diagrams have content', () => {
    const project = createProjectWithContent();
    // Also add content to ObjectDiagram
    project.diagrams.ObjectDiagram[0].model = {
      version: '3.0.0' as const,
      type: UMLDiagramType.ObjectDiagram,
      size: { width: 1400, height: 740 },
      elements: { 'obj-1': { id: 'obj-1', type: 'Object', name: 'user1' } as any },
      relationships: {},
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    };
    setupUseProject({ currentProject: project });
    render(<ProjectSettingsPanel />);

    expect(screen.getByText('2 diagrams with content')).toBeInTheDocument();
  });
});
