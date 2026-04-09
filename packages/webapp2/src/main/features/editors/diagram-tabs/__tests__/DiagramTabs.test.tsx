import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UMLDiagramType } from '@besser/wme';
import { DiagramTabs } from '../DiagramTabs';
import { MAX_DIAGRAMS_PER_TYPE, ProjectDiagram, SupportedDiagramType } from '../../../../shared/types/project';
import { createDefaultProject } from '../../../../shared/types/project';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn(() => Promise.resolve());

vi.mock('../../../../app/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn((selector: any) => selector(mockState)),
}));

vi.mock('../../../../app/store/workspaceSlice', () => ({
  addDiagramThunk: vi.fn((payload: any) => ({ type: 'addDiagram', payload })),
  removeDiagramThunk: vi.fn((payload: any) => ({ type: 'removeDiagram', payload })),
  renameDiagramThunk: vi.fn((payload: any) => ({ type: 'renameDiagram', payload })),
  switchDiagramIndexThunk: vi.fn((payload: any) => ({ type: 'switchDiagramIndex', payload })),
  updateDiagramReferencesThunk: vi.fn((payload: any) => ({ type: 'updateRefs', payload })),
  bumpEditorRevision: vi.fn(() => ({ type: 'bumpRevision' })),
  selectActiveDiagramIndex: (state: any) => state.workspace.activeDiagramIndex,
  selectDiagramsForActiveType: (state: any) => state.workspace.diagrams,
  selectActiveDiagramType: (state: any) => state.workspace.activeDiagramType,
  selectProject: (state: any) => state.workspace.project,
}));

vi.mock('@besser/wme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@besser/wme')>();
  return {
    ...actual,
    diagramBridge: {
      setClassDiagramData: vi.fn(),
    },
  };
});

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({
  getPostHog: () => null,
}));

// ── State helpers ────────────────────────────────────────────────────────

const makeDiagram = (id: string, title: string): ProjectDiagram => ({
  id,
  title,
  lastUpdate: new Date().toISOString(),
  model: {
    version: '3.0.0' as const,
    type: UMLDiagramType.ClassDiagram,
    size: { width: 1400, height: 740 },
    elements: {},
    relationships: {},
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  },
});

let mockState: any;

const setMockState = (overrides: {
  diagrams?: ProjectDiagram[];
  activeDiagramIndex?: number;
  activeDiagramType?: SupportedDiagramType;
  project?: any;
}) => {
  const defaultProject = createDefaultProject('Test', '', 'owner');
  mockState = {
    workspace: {
      diagrams: overrides.diagrams ?? [makeDiagram('d1', 'Class Diagram')],
      activeDiagramIndex: overrides.activeDiagramIndex ?? 0,
      activeDiagramType: overrides.activeDiagramType ?? 'ClassDiagram',
      project: overrides.project ?? defaultProject,
    },
  };
};

// ── Tests ────────────────────────────────────────────────────────────────

describe('DiagramTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockState({});
  });

  it('renders tabs for diagrams', () => {
    setMockState({
      diagrams: [
        makeDiagram('d1', 'Class Diagram'),
        makeDiagram('d2', 'Class Diagram 2'),
      ],
    });

    render(<DiagramTabs />);

    expect(screen.getByText('Class Diagram')).toBeInTheDocument();
    expect(screen.getByText('Class Diagram 2')).toBeInTheDocument();
  });

  it('highlights the active tab with aria-selected', () => {
    setMockState({
      diagrams: [
        makeDiagram('d1', 'First'),
        makeDiagram('d2', 'Second'),
      ],
      activeDiagramIndex: 1,
    });

    render(<DiagramTabs />);

    const firstTab = screen.getByLabelText('Diagram tab: First');
    const secondTab = screen.getByLabelText('Diagram tab: Second');

    expect(firstTab).toHaveAttribute('aria-selected', 'false');
    expect(secondTab).toHaveAttribute('aria-selected', 'true');
  });

  it('calls switchDiagramIndexThunk when clicking a non-active tab', async () => {
    const { switchDiagramIndexThunk } = await import('../../../../app/store/workspaceSlice');

    setMockState({
      diagrams: [
        makeDiagram('d1', 'First'),
        makeDiagram('d2', 'Second'),
      ],
      activeDiagramIndex: 0,
    });

    render(<DiagramTabs />);

    const secondTab = screen.getByLabelText('Diagram tab: Second');
    fireEvent.click(secondTab);

    expect(switchDiagramIndexThunk).toHaveBeenCalledWith({
      diagramType: 'ClassDiagram',
      index: 1,
    });
  });

  it('does not dispatch when clicking the already-active tab', async () => {
    const { switchDiagramIndexThunk } = await import('../../../../app/store/workspaceSlice');

    setMockState({
      diagrams: [makeDiagram('d1', 'First')],
      activeDiagramIndex: 0,
    });

    render(<DiagramTabs />);

    const tab = screen.getByLabelText('Diagram tab: First');
    fireEvent.click(tab);

    expect(switchDiagramIndexThunk).not.toHaveBeenCalled();
  });

  it('shows add button when under MAX_DIAGRAMS_PER_TYPE', () => {
    setMockState({
      diagrams: [makeDiagram('d1', 'Diagram 1')],
    });

    render(<DiagramTabs />);

    expect(screen.getByLabelText('Add new diagram')).toBeInTheDocument();
  });

  it('hides add button when at MAX_DIAGRAMS_PER_TYPE', () => {
    const diagrams = Array.from({ length: MAX_DIAGRAMS_PER_TYPE }, (_, i) =>
      makeDiagram(`d${i}`, `Diagram ${i + 1}`),
    );
    setMockState({ diagrams });

    render(<DiagramTabs />);

    expect(screen.queryByLabelText('Add new diagram')).not.toBeInTheDocument();
  });

  it('shows close button for diagrams when more than one exists', () => {
    setMockState({
      diagrams: [
        makeDiagram('d1', 'First'),
        makeDiagram('d2', 'Second'),
      ],
      activeDiagramIndex: 0,
    });

    render(<DiagramTabs />);

    // Close buttons should exist (one per tab when multiple diagrams)
    const closeButtons = screen.getAllByTitle('Close tab');
    expect(closeButtons.length).toBe(2);
  });

  it('does not show close button when only one diagram exists', () => {
    setMockState({
      diagrams: [makeDiagram('d1', 'Only Diagram')],
    });

    render(<DiagramTabs />);

    expect(screen.queryByTitle('Close tab')).not.toBeInTheDocument();
  });

  it('shows reference section for ObjectDiagram', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setMockState({
      diagrams: [makeDiagram('od1', 'Object Diagram')],
      activeDiagramType: 'ObjectDiagram',
      project,
    });

    const { container } = render(<DiagramTabs />);

    expect(screen.getByText('References')).toBeInTheDocument();
    // The select element has id="ref-class-diagram"
    const selectEl = container.querySelector('#ref-class-diagram');
    expect(selectEl).toBeInTheDocument();
  });

  it('shows reference section for GUINoCodeDiagram', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setMockState({
      diagrams: [{
        id: 'gui1',
        title: 'GUI Diagram',
        lastUpdate: new Date().toISOString(),
        model: { pages: [], styles: [], assets: [], symbols: [], version: '0.21.13' },
      }],
      activeDiagramType: 'GUINoCodeDiagram',
      project,
    });

    render(<DiagramTabs />);

    expect(screen.getByText('References')).toBeInTheDocument();
  });

  it('does not show reference section for ClassDiagram', () => {
    setMockState({
      diagrams: [makeDiagram('cd1', 'Class Diagram')],
      activeDiagramType: 'ClassDiagram',
    });

    render(<DiagramTabs />);

    expect(screen.queryByText('References')).not.toBeInTheDocument();
  });

  it('does not show reference section for StateMachineDiagram', () => {
    setMockState({
      diagrams: [makeDiagram('sm1', 'State Machine')],
      activeDiagramType: 'StateMachineDiagram',
    });

    render(<DiagramTabs />);

    expect(screen.queryByText('References')).not.toBeInTheDocument();
  });

  it('returns null when no diagrams exist', () => {
    setMockState({ diagrams: [] });

    const { container } = render(<DiagramTabs />);
    expect(container.innerHTML).toBe('');
  });

  it('shows "No Class Diagrams available" when ObjectDiagram has no class diagrams to reference', () => {
    const project = createDefaultProject('Test', '', 'owner');
    // Remove all ClassDiagrams
    project.diagrams.ClassDiagram = [];

    setMockState({
      diagrams: [makeDiagram('od1', 'Object Diagram')],
      activeDiagramType: 'ObjectDiagram',
      project,
    });

    render(<DiagramTabs />);

    expect(screen.getByText('No Class Diagrams available')).toBeInTheDocument();
  });

  it('renders class diagram reference dropdown with correct options', () => {
    const project = createDefaultProject('Test', '', 'owner');
    // Add a second ClassDiagram
    project.diagrams.ClassDiagram.push({
      id: 'cd2',
      title: 'Class Diagram 2',
      lastUpdate: new Date().toISOString(),
      model: {
        version: '3.0.0' as const,
        type: UMLDiagramType.ClassDiagram,
        size: { width: 1400, height: 740 },
        elements: {},
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      },
    });

    setMockState({
      diagrams: [makeDiagram('od1', 'Object Diagram')],
      activeDiagramType: 'ObjectDiagram',
      project,
    });

    const { container } = render(<DiagramTabs />);

    // Use the select element id since aria-label is shared with InfoTooltip
    const select = container.querySelector('#ref-class-diagram') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe('Class Diagram');
    expect(options[1].textContent).toBe('Class Diagram 2');
  });

  it('shows linked diagrams toggle button for reference types', () => {
    const project = createDefaultProject('Test', '', 'owner');
    setMockState({
      diagrams: [makeDiagram('od1', 'Object Diagram')],
      activeDiagramType: 'ObjectDiagram',
      project,
    });

    render(<DiagramTabs />);

    // The "Linked Diagrams" toggle should be visible
    expect(screen.getByLabelText('Collapse linked diagrams')).toBeInTheDocument();
  });
});
