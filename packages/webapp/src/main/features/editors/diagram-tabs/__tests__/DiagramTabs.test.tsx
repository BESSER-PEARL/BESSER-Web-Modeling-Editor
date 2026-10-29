import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UMLDiagramType } from '@besser/wme';
import { DiagramTabs } from '../DiagramTabs';
import { ApollonEditorContext } from '../../uml/apollon-editor-context';
import { MAX_DIAGRAMS_PER_TYPE, ProjectDiagram, SupportedDiagramType } from '../../../../shared/types/project';
import { createDefaultProject } from '../../../../shared/types/project';
import { streamSse } from '../../../../shared/services/sse/sseClient';
import type { SemanticSearchEvent } from '../../../../shared/services/validation/semanticCheck';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn(() => Promise.resolve());

const NO_DIAGRAMS: ProjectDiagram[] = [];

vi.mock('../../../../app/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn((selector: any) => selector(mockState)),
}));

vi.mock('../../../../app/store/workspaceSlice', () => ({
  addDiagramThunk: vi.fn((payload: any) => ({ type: 'addDiagram', payload })),
  removeDiagramThunk: vi.fn((payload: any) => ({ type: 'removeDiagram', payload })),
  renameDiagramThunk: vi.fn((payload: any) => ({ type: 'renameDiagram', payload })),
  switchDiagramIndexThunk: vi.fn((payload: any) => ({ type: 'switchDiagramIndex', payload })),
  updateDiagramModelThunk: vi.fn((payload: any) => ({ type: 'updateDiagramModel', payload })),
  updateDiagramReferencesThunk: vi.fn((payload: any) => ({ type: 'updateRefs', payload })),
  bumpEditorRevision: vi.fn(() => ({ type: 'bumpRevision' })),
  selectActiveDiagramIndex: (state: any) => state.workspace.activeDiagramIndex,
  selectDiagramsForActiveType: (state: any) => state.workspace.diagrams,
  selectActiveDiagramType: (state: any) => state.workspace.activeDiagramType,
  selectProject: (state: any) => state.workspace.project,
  selectClassDiagrams: (state: any) => state.workspace.project?.diagrams?.ClassDiagram ?? NO_DIAGRAMS,
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
    info: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    update: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/sse/sseClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../shared/services/sse/sseClient')>();
  return { ...actual, streamSse: vi.fn() };
});

vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({
  getPostHog: () => null,
}));

const mockGlobalConfirm = vi.fn((_options: unknown) => Promise.resolve(true));
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({
  globalConfirm: (options: unknown) => mockGlobalConfirm(options),
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

  it('respects onRequestTabSwitch and blocks tab change when it returns false', async () => {
    const { switchDiagramIndexThunk } = await import('../../../../app/store/workspaceSlice');

    setMockState({
      diagrams: [
        makeDiagram('d1', 'First'),
        makeDiagram('d2', 'Second'),
      ],
      activeDiagramIndex: 0,
    });

    const guard = vi.fn(async () => false);
    render(<DiagramTabs onRequestTabSwitch={guard} />);

    fireEvent.click(screen.getByLabelText('Diagram tab: Second'));

    await waitFor(() => {
      expect(guard).toHaveBeenCalledWith(1);
      expect(switchDiagramIndexThunk).not.toHaveBeenCalled();
    });
  });

  it('shows add button when under MAX_DIAGRAMS_PER_TYPE', () => {
    setMockState({
      diagrams: [makeDiagram('d1', 'Diagram 1')],
    });

    render(<DiagramTabs />);

    expect(screen.getByLabelText('Add a new diagram tab')).toBeInTheDocument();
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

    // Delete buttons should exist (one per tab when multiple diagrams)
    const deleteButtons = screen.getAllByTitle('Delete diagram');
    expect(deleteButtons.length).toBe(2);
  });

  // The tab "x" removes the diagram from the project (ProjectStorageRepository.removeDiagram),
  // so it must ask first instead of deleting on a single click.
  it('asks for confirmation before deleting a diagram', async () => {
    setMockState({ diagrams: [makeDiagram('d1', 'First'), makeDiagram('d2', 'Second')] });
    mockGlobalConfirm.mockResolvedValueOnce(true);

    render(<DiagramTabs />);
    fireEvent.click(screen.getAllByTitle('Delete diagram')[1]);

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'removeDiagram' })));
    expect(mockGlobalConfirm).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' }));
  });

  it('keeps the diagram when the deletion is cancelled', async () => {
    setMockState({ diagrams: [makeDiagram('d1', 'First'), makeDiagram('d2', 'Second')] });
    mockGlobalConfirm.mockResolvedValueOnce(false);

    render(<DiagramTabs />);
    fireEvent.click(screen.getAllByTitle('Delete diagram')[1]);

    await waitFor(() => expect(mockGlobalConfirm).toHaveBeenCalled());
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'removeDiagram' }));
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

    render(<DiagramTabs />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('id', 'ref-class-diagram');
    expect(trigger).toHaveTextContent('Class Diagram');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe('Class Diagram');
    expect(options[1].textContent).toBe('Class Diagram 2');
  });

  it('persists the picked class diagram reference by id', async () => {
    const { updateDiagramReferencesThunk } = await import('../../../../app/store/workspaceSlice');
    const project = createDefaultProject('Test', '', 'owner');
    project.diagrams.ClassDiagram.push({
      ...project.diagrams.ClassDiagram[0],
      id: 'cd2',
      title: 'Class Diagram 2',
    });
    setMockState({
      diagrams: [makeDiagram('od1', 'Object Diagram')],
      activeDiagramType: 'ObjectDiagram',
      project,
    });

    render(<DiagramTabs />);

    const trigger = screen.getByRole('combobox', {
      name: 'Select which Class Diagram provides the data model for this Object Diagram',
    });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(screen.getByRole('option', { name: 'Class Diagram 2' }));

    expect(updateDiagramReferencesThunk).toHaveBeenCalledWith(
      expect.objectContaining({ diagramType: 'ObjectDiagram', references: { ClassDiagram: 'cd2' } }),
    );
  });

  it('shows the broken-reference placeholder when the referenced class diagram is gone', () => {
    const project = createDefaultProject('Test', '', 'owner');
    const od = { ...makeDiagram('od1', 'Object Diagram'), references: { ClassDiagram: 'deleted-id' } };
    setMockState({ diagrams: [od], activeDiagramType: 'ObjectDiagram', project });

    render(<DiagramTabs />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Reference broken - please reselect');
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
  describe('keyboard navigation', () => {
    const threeTabs = () =>
      setMockState({
        diagrams: [makeDiagram('d1', 'First'), makeDiagram('d2', 'Second'), makeDiagram('d3', 'Third')],
        activeDiagramIndex: 0,
      });

    it('renders the tabs inside a tablist with a roving tabIndex', () => {
      threeTabs();
      render(<DiagramTabs />);

      const tabs = screen.getAllByRole('tab');
      expect(screen.getByRole('tablist')).toContainElement(tabs[0]);
      expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    });

    it('moves focus and activates with ArrowRight, ArrowLeft (wrapping) and End', async () => {
      const { switchDiagramIndexThunk } = await import('../../../../app/store/workspaceSlice');
      threeTabs();
      render(<DiagramTabs />);
      const [first, second, third] = screen.getAllByRole('tab');

      fireEvent.keyDown(first, { key: 'ArrowRight' });
      expect(second).toHaveFocus();
      await waitFor(() => expect(switchDiagramIndexThunk).toHaveBeenCalledWith({ diagramType: 'ClassDiagram', index: 1 }));

      fireEvent.keyDown(first, { key: 'ArrowLeft' });
      expect(third).toHaveFocus();
      await waitFor(() => expect(switchDiagramIndexThunk).toHaveBeenCalledWith({ diagramType: 'ClassDiagram', index: 2 }));

      fireEvent.keyDown(first, { key: 'End' });
      expect(third).toHaveFocus();
    });

    it('activates the focused tab with Enter', async () => {
      const { switchDiagramIndexThunk } = await import('../../../../app/store/workspaceSlice');
      threeTabs();
      render(<DiagramTabs />);

      fireEvent.keyDown(screen.getByLabelText('Diagram tab: Third'), { key: 'Enter' });
      await waitFor(() => expect(switchDiagramIndexThunk).toHaveBeenCalledWith({ diagramType: 'ClassDiagram', index: 2 }));
    });

    it('starts renaming the focused tab with F2', () => {
      threeTabs();
      render(<DiagramTabs />);

      fireEvent.keyDown(screen.getByLabelText('Diagram tab: Second'), { key: 'F2' });
      expect(screen.getByLabelText('Rename diagram')).toHaveValue('Second');
    });

    it('ignores navigation keys typed into the rename input', async () => {
      const { switchDiagramIndexThunk } = await import('../../../../app/store/workspaceSlice');
      threeTabs();
      render(<DiagramTabs />);

      fireEvent.keyDown(screen.getByLabelText('Diagram tab: First'), { key: 'F2' });
      fireEvent.keyDown(screen.getByLabelText('Rename diagram'), { key: 'ArrowRight' });
      expect(switchDiagramIndexThunk).not.toHaveBeenCalled();
    });
  });

  it('announces a broken class-diagram reference to assistive technology', () => {
    const project = createDefaultProject('Test', '', 'owner');
    const od = { ...makeDiagram('od1', 'Object Diagram'), references: { ClassDiagram: 'deleted-id' } };
    setMockState({ diagrams: [od], activeDiagramType: 'ObjectDiagram', project });

    render(<DiagramTabs />);

    expect(
      screen.getByRole('img', { name: 'The referenced diagram was deleted. Please select a new one.' }),
    ).toBeInTheDocument();
  });
});

// ── Semantic generation ──────────────────────────────────────────────────

const umlModel = (type: UMLDiagramType, elements: Record<string, unknown> = {}) => ({
  version: '3.0.0' as const,
  type,
  size: { width: 1400, height: 740 },
  elements,
  relationships: {},
  interactive: { elements: {}, relationships: {} },
  assessments: {},
});

const generatedObjectDiagram = umlModel(UMLDiagramType.ObjectDiagram, {
  o1: { id: 'o1', type: 'ObjectName', name: 'book_0' },
});

const instanceFound: SemanticSearchEvent = {
  done: true,
  isValid: true,
  message: 'Instance found within 5 objects per class.',
  object_model: generatedObjectDiagram,
};

describe('semantic generation', () => {
  let releaseSearch: (event: SemanticSearchEvent) => void;
  let editor: { model: unknown; nextRender: Promise<void> };

  /** Makes the object diagram `id` active, referencing a class diagram with one class. */
  const activateObjectDiagram = (id: string) => {
    const project = createDefaultProject('Test', '', 'owner');
    project.diagrams.ClassDiagram[0].model = umlModel(UMLDiagramType.ClassDiagram, {
      c1: { id: 'c1', type: 'Class', name: 'Book' },
    }) as any;
    setMockState({ diagrams: [makeDiagram(id, 'Object Diagram')], activeDiagramType: 'ObjectDiagram', project });
  };

  const tabs = () => (
    <ApollonEditorContext.Provider value={{ editor: editor as any, setEditor: vi.fn() }}>
      <DiagramTabs />
    </ApollonEditorContext.Provider>
  );

  const clickSemanticGeneration = () => fireEvent.click(screen.getByText('Semantic generation'));

  beforeEach(() => {
    vi.clearAllMocks();
    mockDispatch.mockImplementation(
      () => Object.assign(Promise.resolve(), { unwrap: () => Promise.resolve() }) as any,
    );
    editor = { model: umlModel(UMLDiagramType.ObjectDiagram), nextRender: Promise.resolve() };
    // The search runs until the test releases its last event
    vi.mocked(streamSse).mockImplementation(
      () =>
        (async function* () {
          yield await new Promise<SemanticSearchEvent>((resolve) => {
            releaseSearch = resolve;
          });
        })() as AsyncGenerator<never, void, void>,
    );
    activateObjectDiagram('od1');
  });

  afterEach(() => {
    mockDispatch.mockImplementation(() => Promise.resolve());
  });

  it('asks to confirm before replacing a non-empty object diagram', async () => {
    const { updateDiagramModelThunk } = await import('../../../../app/store/workspaceSlice');
    const objects = umlModel(UMLDiagramType.ObjectDiagram, { o9: { id: 'o9', type: 'ObjectName', name: 'mine' } });
    editor.model = objects;
    mockGlobalConfirm.mockResolvedValueOnce(false);
    render(tabs());

    clickSemanticGeneration();
    await waitFor(() => expect(mockGlobalConfirm).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(streamSse).not.toHaveBeenCalled();
    expect(updateDiagramModelThunk).not.toHaveBeenCalled();
    expect(editor.model).toBe(objects);
  });

  it('replaces the object diagram with the generated one', async () => {
    const { updateDiagramModelThunk } = await import('../../../../app/store/workspaceSlice');
    render(tabs());

    clickSemanticGeneration();
    await waitFor(() => expect(streamSse).toHaveBeenCalled());
    releaseSearch(instanceFound);

    await waitFor(() => expect(editor.model).toEqual(generatedObjectDiagram));
    expect(updateDiagramModelThunk).toHaveBeenCalledWith({ model: generatedObjectDiagram });
  });

  it('discards the result when the user leaves the diagram during the search', async () => {
    const { updateDiagramModelThunk } = await import('../../../../app/store/workspaceSlice');
    const { toast } = await import('react-toastify');
    const { rerender } = render(tabs());

    clickSemanticGeneration();
    await waitFor(() => expect(streamSse).toHaveBeenCalled());
    activateObjectDiagram('od2');
    rerender(tabs());
    releaseSearch(instanceFound);

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith('Semantic generation stopped: you left the object diagram.'),
    );
    expect(updateDiagramModelThunk).not.toHaveBeenCalled();
    expect(editor.model).toEqual(umlModel(UMLDiagramType.ObjectDiagram));
  });

  it('ignores a second click while a search runs', async () => {
    const { toast } = await import('react-toastify');
    render(tabs());

    clickSemanticGeneration();
    await waitFor(() => expect(streamSse).toHaveBeenCalled());
    clickSemanticGeneration();

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('A semantic check is already running.'));
    expect(streamSse).toHaveBeenCalledTimes(1);
    releaseSearch(instanceFound);
    await waitFor(() => expect(editor.model).toEqual(generatedObjectDiagram));
  });
});
