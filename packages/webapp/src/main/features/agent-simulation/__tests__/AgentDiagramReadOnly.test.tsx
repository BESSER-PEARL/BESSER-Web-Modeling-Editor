import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProject, getActiveDiagram } from '../../../shared/types/project';
import { workspaceReducer, type WorkspaceState } from '../../../app/store/workspaceSlice';
import { agentSimulationReducer } from '../agentSimulationSlice';
import { AgentDiagramReadOnly } from '../AgentDiagramReadOnly';

type Fake = { model: any; ready: Promise<void>; resolveReady: () => void };
const editors: Fake[] = [];

vi.mock('@besser/wme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@besser/wme')>();
  class FakeEditor {
    model: any;
    ready: Promise<void>;
    resolveReady!: () => void;
    constructor(_container: HTMLElement, options: { model?: unknown }) {
      this.model = options.model;
      this.ready = new Promise((resolve) => (this.resolveReady = resolve));
      editors.push(this);
    }
    fitToElements() {}
    destroy() {}
  }
  return { ...actual, BesserEditor: FakeEditor };
});

const agentModel = {
  version: '4.0.0',
  id: '',
  title: '',
  type: 'AgentDiagram',
  nodes: [
    { id: 'a', type: 'AgentState', position: { x: 0, y: 0 }, data: { name: 'Idle' } },
    { id: 'b', type: 'AgentState', position: { x: 200, y: 0 }, data: { name: 'Greet' } },
  ],
  edges: [{ id: 'ab', type: 'AgentStateTransition', source: 'a', target: 'b', data: {} }],
  assessments: {},
};

const fillOf = (model: any, id: string) => model.nodes.find((n: any) => n.id === id).data.fillColor;

describe('AgentDiagramReadOnly', () => {
  it('shows a state change that arrived before the editor was ready', async () => {
    const project = createDefaultProject('P', '', '');
    const diagram = getActiveDiagram(project, 'AgentDiagram')!;
    diagram.model = agentModel as any;
    const workspace: WorkspaceState = {
      ...workspaceReducer(undefined, { type: '@@init' }),
      project,
      activeDiagramType: 'AgentDiagram',
      activeDiagram: diagram,
    };
    const store = configureStore({
      reducer: { workspace: workspaceReducer, agentSimulation: agentSimulationReducer },
      preloadedState: { workspace, agentSimulation: agentSimulationReducer(undefined, { type: '@@init' }) },
    });
    const view = (state: string) => (
      <Provider store={store}>
        <AgentDiagramReadOnly currentState={state} />
      </Provider>
    );

    const { rerender } = render(view('Idle'));
    rerender(view('Greet'));
    await act(async () => {
      editors[0].resolveReady();
      await editors[0].ready;
    });

    const shown = editors[0].model;
    expect(fillOf(shown, 'b')).toBeDefined();
    expect(fillOf(shown, 'a')).toBeUndefined();
    expect(shown.edges[0].data.strokeColor).toBeDefined();
  });
});
