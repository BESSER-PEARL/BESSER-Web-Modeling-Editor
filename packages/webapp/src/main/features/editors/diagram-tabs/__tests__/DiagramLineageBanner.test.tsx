import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UMLDiagramType, UMLModel } from '@besser/wme';
import { DiagramLineageBanner } from '../DiagramLineageBanner';
import { BesserProject, ProjectDiagram, createDefaultProject } from '../../../../shared/types/project';
import { hashUmlModel } from '../../../../shared/utils/lineageHash';

const mockDispatch = vi.fn((action: unknown) => ({ unwrap: () => Promise.resolve(action) }));

vi.mock('../../../../app/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn((selector: (state: unknown) => unknown) => selector(mockState)),
}));

vi.mock('../../../../app/store/workspaceSlice', () => ({
  openDiagramThunk: vi.fn((payload: unknown) => ({ type: 'openDiagram', payload })),
  selectProject: (state: MockState) => state.workspace.project,
  selectActiveDiagramType: (state: MockState) => state.workspace.activeDiagramType,
}));

interface MockState {
  workspace: { project: BesserProject; activeDiagramType: string };
}
let mockState: MockState;

const bpmnModel = (laneRef?: string): UMLModel => ({
  version: '3.0.0',
  type: UMLDiagramType.BPMN,
  size: { width: 800, height: 600 },
  elements: {
    lane1: {
      id: 'lane1',
      name: 'Reviewer',
      type: 'BPMNSwimlane',
      owner: null,
      bounds: { x: 0, y: 0, width: 400, height: 120 },
      ...(laneRef ? { agentDiagramRef: laneRef } : {}),
    },
  },
  relationships: {},
  interactive: { elements: {}, relationships: {} },
  assessments: {},
});

const setup = (activeDiagramType: string, mutate: (project: BesserProject) => void): BesserProject => {
  const project = createDefaultProject('P', '', '');
  mutate(project);
  mockState = { workspace: { project, activeDiagramType } };
  return project;
};

describe('DiagramLineageBanner', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('links an Agent diagram back to the BPMN lane that defines it', async () => {
    const project = setup('AgentDiagram', (p) => {
      p.diagrams.BPMN[0].model = bpmnModel(p.diagrams.AgentDiagram[0].id);
    });
    render(<DiagramLineageBanner activeDiagram={project.diagrams.AgentDiagram[0]} />);

    const link = screen.getByRole('button', { name: /Implementation of Reviewer/ });
    fireEvent.click(link);
    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'openDiagram', payload: { diagramType: 'BPMN', index: 0 } }),
    );
  });

  it('marks a derived diagram whose source changed as stale', () => {
    const project = setup('ComponentDiagram', (p) => {
      p.diagrams.BPMN[0].model = bpmnModel();
    });
    const derived: ProjectDiagram = {
      ...project.diagrams.ComponentDiagram[0],
      derivedFrom: {
        sourceDiagramId: project.diagrams.BPMN[0].id,
        sourceDiagramType: 'BPMN',
        derivationKind: 'bpmn-to-component',
        derivedAt: new Date().toISOString(),
        sourceModelHash: 'outdated',
      },
    };
    render(<DiagramLineageBanner activeDiagram={derived} />);

    expect(screen.getByRole('button', { name: /Derived from/ })).toBeInTheDocument();
    expect(screen.getByText('source changed')).toBeInTheDocument();
  });

  it('shows no stale marker while the source is unchanged', () => {
    const project = setup('ComponentDiagram', (p) => {
      p.diagrams.BPMN[0].model = bpmnModel();
    });
    const source = project.diagrams.BPMN[0];
    const derived: ProjectDiagram = {
      ...project.diagrams.ComponentDiagram[0],
      derivedFrom: {
        sourceDiagramId: source.id,
        sourceDiagramType: 'BPMN',
        derivationKind: 'bpmn-to-component',
        derivedAt: new Date().toISOString(),
        sourceModelHash: hashUmlModel(bpmnModel()),
      },
    };
    render(<DiagramLineageBanner activeDiagram={derived} />);

    expect(screen.queryByText('source changed')).not.toBeInTheDocument();
  });

  it('reports a deleted source diagram', () => {
    const project = setup('ComponentDiagram', () => undefined);
    const derived: ProjectDiagram = {
      ...project.diagrams.ComponentDiagram[0],
      derivedFrom: {
        sourceDiagramId: 'gone',
        sourceDiagramType: 'BPMN',
        derivationKind: 'bpmn-to-component',
        derivedAt: new Date().toISOString(),
        sourceModelHash: 'x',
      },
    };
    render(<DiagramLineageBanner activeDiagram={derived} />);

    expect(screen.getByText(/Source diagram deleted/)).toBeInTheDocument();
  });

  it('renders nothing for a diagram without lineage', () => {
    const project = setup('ClassDiagram', () => undefined);
    const { container } = render(<DiagramLineageBanner activeDiagram={project.diagrams.ClassDiagram[0]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
