import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UMLDiagramType, type UMLModel } from '@besser/wme';
import { HiddenPerspectivesBanner } from '../HiddenPerspectivesBanner';
import { createDefaultProject } from '../../../shared/types/project';
import type { BesserProject } from '../../../shared/types/project';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn(() => Promise.resolve());

let mockState: { workspace: { project: BesserProject | null } };

vi.mock('../../../app/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => selector(mockState),
}));

const setPerspectiveEnabledThunkSpy = vi.fn((payload: any) => ({
  type: 'setPerspectiveEnabled',
  payload,
}));

vi.mock('../../../app/store/workspaceSlice', () => ({
  selectProject: (state: any) => state.workspace.project,
  setPerspectiveEnabledThunk: (payload: any) => setPerspectiveEnabledThunkSpy(payload),
}));

function populatedClassModel(): UMLModel {
  return {
    version: '3.0.0',
    type: UMLDiagramType.ClassDiagram,
    size: { width: 1400, height: 740 },
    elements: { 'c-1': { id: 'c-1' } as any },
    relationships: {},
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  };
}

beforeEach(() => {
  mockDispatch.mockClear();
  setPerspectiveEnabledThunkSpy.mockClear();
});

describe('HiddenPerspectivesBanner', () => {
  it('renders nothing when no project is loaded', () => {
    mockState = { workspace: { project: null } };
    const { container } = render(<HiddenPerspectivesBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no perspective is hidden', () => {
    mockState = { workspace: { project: createDefaultProject('Clean', '', 'me') } };
    const { container } = render(<HiddenPerspectivesBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when a perspective is hidden but its diagrams are empty', () => {
    const project = createDefaultProject('Empty', '', 'me');
    project.settings.perspectives.AgentDiagram = false;
    mockState = { workspace: { project } };

    const { container } = render(<HiddenPerspectivesBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an Enable button per hidden referenced perspective', () => {
    const project = createDefaultProject('Refs', '', 'me');
    project.settings.perspectives.ClassDiagram = false;
    project.diagrams.ClassDiagram[0].model = populatedClassModel();
    project.diagrams.GUINoCodeDiagram[0].references = {
      ClassDiagram: project.diagrams.ClassDiagram[0].id,
    };
    mockState = { workspace: { project } };

    render(<HiddenPerspectivesBanner />);
    expect(screen.getByTestId('hidden-perspectives-banner')).toBeInTheDocument();
    expect(screen.getByTestId('enable-perspective-ClassDiagram')).toBeInTheDocument();
  });

  it('dispatches setPerspectiveEnabledThunk with enabled:true when Enable is clicked', () => {
    const project = createDefaultProject('Refs', '', 'me');
    project.settings.perspectives.ClassDiagram = false;
    project.diagrams.ClassDiagram[0].model = populatedClassModel();
    project.diagrams.GUINoCodeDiagram[0].references = {
      ClassDiagram: project.diagrams.ClassDiagram[0].id,
    };
    mockState = { workspace: { project } };

    render(<HiddenPerspectivesBanner />);
    fireEvent.click(screen.getByTestId('enable-perspective-ClassDiagram'));

    expect(setPerspectiveEnabledThunkSpy).toHaveBeenCalledWith({
      type: 'ClassDiagram',
      enabled: true,
    });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
});
