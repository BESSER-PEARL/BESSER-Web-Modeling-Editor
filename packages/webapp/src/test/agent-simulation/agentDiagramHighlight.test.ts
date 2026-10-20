import { describe, expect, it } from 'vitest';
import type { UMLModel } from '@besser/wme';
import {
  buildHighlightedModel,
  findStateNodeId,
  findTransitionEdgeId,
} from '../../main/features/agent-simulation/AgentDiagramReadOnly';

// The simulator page highlights, on the v4 (React Flow) agent model, the state
// the running agent is in and the transition it took to get there.
const state = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'AgentState',
  position: { x: 0, y: 0 },
  width: 160,
  height: 80,
  measured: { width: 160, height: 80 },
  data: { name, bodies: [], fallbackBodies: [], ...extra },
});

const transition = (id: string, source: string, target: string) => ({
  id,
  source,
  target,
  type: 'AgentStateTransition',
  sourceHandle: 'right',
  targetHandle: 'left',
  data: { points: [] },
});

const model = {
  version: '4.0.0',
  id: 'agent',
  title: 'Greeting agent',
  type: 'AgentDiagram',
  nodes: [
    state('s-init', 'initial', { initial: true }),
    state('s-greet', 'greeting', { fillColor: '#ffffff' }),
    state('s-bye', 'farewell'),
  ],
  edges: [transition('t-1', 's-init', 's-greet'), transition('t-2', 's-greet', 's-bye')],
  assessments: {},
} as unknown as UMLModel;

describe('agent simulator diagram highlight', () => {
  it('finds a state node and the transition between two states by name', () => {
    expect(findStateNodeId(model, 'greeting')).toBe('s-greet');
    expect(findStateNodeId(model, 'missing')).toBeNull();
    expect(findStateNodeId(model, null)).toBeNull();
    expect(findTransitionEdgeId(model, 'greeting', 'farewell')).toBe('t-2');
    expect(findTransitionEdgeId(model, 'farewell', 'greeting')).toBeNull();
    expect(findTransitionEdgeId(model, null, 'farewell')).toBeNull();
  });

  it('fills the active state and strokes the taken transition only', () => {
    const highlighted = buildHighlightedModel(model, 'farewell', 't-2');
    const fill = (id: string) =>
      (highlighted.nodes.find((n) => n.id === id)?.data as { fillColor?: string }).fillColor;
    expect(fill('s-bye')).toBe('#03d7fc');
    expect(fill('s-greet')).toBe('#ffffff');
    expect(fill('s-init')).toBeUndefined();
    const stroke = (id: string) =>
      (highlighted.edges.find((e) => e.id === id)?.data as { strokeColor?: string }).strokeColor;
    expect(stroke('t-2')).toBe('#03d7fc');
    expect(stroke('t-1')).toBeUndefined();
  });

  it('never mutates the stored model, so colours return when the highlight moves', () => {
    const snapshot = JSON.stringify(model);
    buildHighlightedModel(model, 'greeting', 't-1');
    expect(JSON.stringify(model)).toBe(snapshot);
    expect(buildHighlightedModel(model, null)).toBe(model);
  });
});
