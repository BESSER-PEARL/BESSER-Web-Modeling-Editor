import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentComponentType } from '@besser/wme';

import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject, getActiveDiagram } from '../../../shared/types/project';

const mockState = vi.hoisted(() => ({ project: null as any, activeDiagram: null as any }));
vi.mock('../../../app/store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector(mockState),
}));
vi.mock('../../../app/store/workspaceSlice', () => ({
  selectActiveDiagram: (s: any) => s.activeDiagram,
  selectProject: (s: any) => s.project,
}));

import { useAgentComponentsStore } from '../hooks/useAgentComponentsStore';
import { IntentsSection } from '../sections/IntentsSection';

const transition = (id: string, intentName: string) => ({
  id,
  type: 'AgentStateTransition',
  source: 's1',
  target: 's2',
  sourceHandle: 'right',
  targetHandle: 'left',
  data: { transitionType: 'predefined', predefined: { predefinedType: 'when_intent_matched', intentName }, points: [] },
});

const seed = () => {
  const project = createDefaultProject('Agent', '', '');
  project.currentDiagramType = 'AgentDiagram';
  const diagram = getActiveDiagram(project, 'AgentDiagram')!;
  diagram.model = {
    ...(diagram.model as any),
    nodes: [],
    edges: [transition('t1', 'Greeting'), transition('t2', 'Goodbye')],
    components: {
      i1: { id: 'i1', type: AgentComponentType.AgentIntent, name: 'Greeting', bodies: [] },
      i2: { id: 'i2', type: AgentComponentType.AgentIntent, name: 'Goodbye', bodies: [] },
    },
  } as any;
  ProjectStorageRepository.saveProject(project);
  mockState.project = project;
  mockState.activeDiagram = diagram;
  return project;
};

const storedEdges = (projectId: string) =>
  (getActiveDiagram(ProjectStorageRepository.loadProject(projectId)!, 'AgentDiagram')!.model as any).edges;

// Live report: renaming an intent on the Components page left every
// "when intent matched" transition pointing at the old name.
describe('intent rename', () => {
  beforeEach(() => localStorage.clear());

  it('renames the intent in the transitions that use it, and only those', () => {
    const project = seed();
    const { result } = renderHook(() => useAgentComponentsStore());
    act(() => result.current.updateComponent('i1', { name: 'Hello' }));

    const edges = storedEdges(project.id);
    expect(edges.find((e: any) => e.id === 't1').data.predefined.intentName).toBe('Hello');
    expect(edges.find((e: any) => e.id === 't2').data.predefined.intentName).toBe('Goodbye');
  });

  it('leaves transitions alone when another intent still has the old name', () => {
    const project = seed();
    const diagram = getActiveDiagram(project, 'AgentDiagram')!;
    (diagram.model as any).components.i3 = { id: 'i3', type: AgentComponentType.AgentIntent, name: 'Greeting', bodies: [] };
    ProjectStorageRepository.saveProject(project);
    const { result } = renderHook(() => useAgentComponentsStore());
    act(() => result.current.updateComponent('i1', { name: 'Hello' }));
    expect(storedEdges(project.id).find((e: any) => e.id === 't1').data.predefined.intentName).toBe('Greeting');
  });
});

// Live report: Enter in a training-phrase field did nothing; it should add the
// next phrase row and put the cursor in it.
describe('IntentsSection training phrases', () => {
  it('adds and focuses a new phrase row on Enter', () => {
    const bodies: Record<string, any> = { b1: { id: 'b1', type: AgentComponentType.AgentIntentBody, name: 'hi' } };
    const intent = () => ({ id: 'i1', type: AgentComponentType.AgentIntent, name: 'Greeting', bodies: Object.keys(bodies) });
    const store: any = {
      intents: [intent()],
      components: { ...bodies },
      updateComponent: vi.fn(),
      removeComponent: vi.fn(),
      updateTrainingSentence: vi.fn(),
      removeTrainingSentence: vi.fn(),
      addComponent: vi.fn(),
      addTrainingSentence: vi.fn(() => {
        bodies.b2 = { id: 'b2', type: AgentComponentType.AgentIntentBody, name: '' };
        return 'b2';
      }),
    };
    const props = { expandedId: 'i1', toggle: vi.fn(), expand: vi.fn() };
    const { rerender } = render(<IntentsSection store={store} {...props} />);

    fireEvent.keyDown(screen.getByDisplayValue('hi'), { key: 'Enter' });
    expect(store.addTrainingSentence).toHaveBeenCalledWith('i1');

    rerender(<IntentsSection store={{ ...store, intents: [intent()], components: { ...bodies } }} {...props} />);
    const inputs = screen.getAllByPlaceholderText(/./).filter((el) => el.tagName === 'INPUT' && !el.id);
    expect(document.activeElement).toBe(inputs[inputs.length - 1]);
  });
});
