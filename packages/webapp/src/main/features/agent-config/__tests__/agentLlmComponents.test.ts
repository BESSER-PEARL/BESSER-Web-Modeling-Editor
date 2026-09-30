import { describe, expect, it } from 'vitest';
import type { BesserNode, UMLModel } from '@besser/wme';
import {
  addAgentLLMToModel,
  findAgentLLMEntry,
  removeAgentLLMFromModel,
  updateAgentLLMInModel,
} from '../AgentConfigurationPanel';
import { listAgentLLMElements, remapComponentLlmReferences, resolveDefaultLlm } from '../agentLlmUtils';

/**
 * The Customization panel's LLMs card lists LLMs from `model.components`
 * (the v4 home, shared with the agent Components page) plus legacy
 * data-only `AgentLLM` canvas nodes; add / update / remove / set-default
 * must operate on the same place the entry was listed from.
 */

const agentModel = (overrides: Partial<UMLModel> = {}): UMLModel =>
  ({
    version: '4.0.0',
    id: 'm',
    title: '',
    type: 'AgentDiagram',
    nodes: [],
    edges: [],
    assessments: {},
    ...overrides,
  }) as UMLModel;

const llmComponent = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'AgentLLM',
  name,
  owner: null,
  provider: 'openai',
  parameters: {},
  num_previous_messages: 1,
  global_context: '',
  ...extra,
});

const legacyLlmNode = (id: string, name: string): BesserNode =>
  ({
    id,
    type: 'AgentLLM',
    position: { x: 0, y: 0 },
    data: { name, provider: 'openai', parameters: {} },
  }) as unknown as BesserNode;

describe('LLMs card — model.components', () => {
  it('Add creates an off-canvas AgentLLM component, never a canvas node', () => {
    const model = agentModel();
    const { nextModel, id } = addAgentLLMToModel(model);
    expect(nextModel.nodes).toEqual([]);
    expect(nextModel.components?.[id]).toMatchObject({
      id,
      type: 'AgentLLM',
      name: 'gpt-4o-mini',
      owner: null,
      provider: 'openai',
    });
    expect(nextModel.components?.[id]).not.toHaveProperty('bounds');
    expect(nextModel.components?.[id]).not.toHaveProperty('position');
    // Input untouched.
    expect(model.components).toBeUndefined();
    // The new LLM is what the default resolver sees.
    expect(resolveDefaultLlm(nextModel, undefined)).toBe('gpt-4o-mini');
  });

  it('Update patches the component and remaps llm_name on components and nodes', () => {
    const model = agentModel({
      components: {
        l1: llmComponent('l1', 'gpt-4o'),
        rag: { id: 'rag', type: 'AgentRagElement', name: 'docs', owner: null, llm_name: 'gpt-4o' },
      },
      nodes: [
        {
          id: 's1',
          type: 'AgentState',
          position: { x: 0, y: 0 },
          data: { name: 'think', stateType: 'reasoning', llm_name: 'gpt-4o', bodies: [{ id: 'b', llm_name: 'gpt-4o' }] },
        } as unknown as BesserNode,
      ],
    });
    const result = updateAgentLLMInModel(model, 'l1', { name: 'claude', provider: 'anthropic' });
    expect(result).not.toBeNull();
    const { nextModel, previousName, newName, isRename } = result!;
    expect([previousName, newName, isRename]).toEqual(['gpt-4o', 'claude', true]);
    expect(nextModel.components?.l1).toMatchObject({ id: 'l1', type: 'AgentLLM', name: 'claude', provider: 'anthropic' });
    expect(nextModel.components?.rag.llm_name).toBe('claude');
    const state = nextModel.nodes[0].data as Record<string, any>;
    expect(state.llm_name).toBe('claude');
    expect(state.bodies[0].llm_name).toBe('claude');
    // No canvas node was created for the LLM.
    expect(nextModel.nodes.map((n) => n.id)).toEqual(['s1']);
  });

  it('Remove deletes the component and resets references to the default', () => {
    const model = agentModel({
      components: {
        l1: llmComponent('l1', 'gpt-4o'),
        l2: llmComponent('l2', 'mistral-small'),
        rag: { id: 'rag', type: 'AgentRagElement', name: 'docs', owner: null, llm_name: 'gpt-4o' },
      },
    });
    const result = removeAgentLLMFromModel(model, 'l1');
    expect(result?.removedName).toBe('gpt-4o');
    expect(Object.keys(result!.nextModel.components ?? {})).toEqual(['l2', 'rag']);
    expect(result!.nextModel.components?.rag.llm_name).toBe('');
    expect(resolveDefaultLlm(result!.nextModel, 'gpt-4o')).toBe('mistral-small');
  });

  it('Set-default lookup finds component LLMs (and legacy nodes)', () => {
    const model = agentModel({
      components: { l1: llmComponent('l1', 'gpt-4o') },
      nodes: [legacyLlmNode('n1', 'legacy-llm')],
    });
    expect(findAgentLLMEntry(model, 'l1')).toMatchObject({ where: 'component', element: { name: 'gpt-4o' } });
    expect(findAgentLLMEntry(model, 'n1')).toMatchObject({ where: 'node', element: { name: 'legacy-llm' } });
    expect(findAgentLLMEntry(model, 'nope')).toBeNull();
    expect(listAgentLLMElements(model).map((l) => l.id)).toEqual(['l1', 'n1']);
  });

  it('still edits and removes a legacy canvas-node LLM in place', () => {
    const model = agentModel({ nodes: [legacyLlmNode('n1', 'old')] });
    const updated = updateAgentLLMInModel(model, 'n1', { name: 'new' })!;
    expect((updated.nextModel.nodes[0].data as { name: string }).name).toBe('new');
    expect(updated.nextModel.components).toBeUndefined();
    const removed = removeAgentLLMFromModel(updated.nextModel, 'n1')!;
    expect(removed.nextModel.nodes).toEqual([]);
  });

  it('remapComponentLlmReferences only touches matching names', () => {
    const components = {
      a: { id: 'a', type: 'AgentRagElement', name: 'a', owner: null, llm_name: 'x' },
      b: { id: 'b', type: 'AgentRagElement', name: 'b', owner: null, llm_name: 'y' },
    };
    remapComponentLlmReferences(components, 'x', 'z');
    expect(components.a.llm_name).toBe('z');
    expect(components.b.llm_name).toBe('y');
  });
});
