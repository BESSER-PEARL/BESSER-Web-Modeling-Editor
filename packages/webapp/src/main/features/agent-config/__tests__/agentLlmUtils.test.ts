import { describe, expect, it } from 'vitest';
import type { BesserNode, UMLModel } from '@besser/wme';
import {
  applyAgentLLMPatch,
  createAgentLLMNode,
  isAgentLLMNode,
  listAgentLLMElements,
  remapLlmReferences,
  resolveDefaultLlm,
  toAgentLLMElement,
} from '../agentLlmUtils';

/**
 * Multi-LLM helpers behind the Agent Customization panel's LLMs card.
 * Develop source: the inline helpers in
 * `AgentConfigurationPanel.tsx` (remapLlmReferences / resolveDefaultLlm /
 * normalizeAgentLLMElement) — ported behavior onto the canonical v4
 * `{nodes[], edges[]}` shape.
 */

const llmNode = (id: string, name: string, extra: Record<string, unknown> = {}): BesserNode =>
  ({
    id,
    type: 'AgentLLM',
    position: { x: 0, y: 0 },
    width: 200,
    height: 90,
    measured: { width: 200, height: 90 },
    data: { name, ...extra },
  }) as unknown as BesserNode;

const modelWith = (nodes: BesserNode[]): UMLModel =>
  ({
    version: '4.0.0',
    id: 'm',
    title: '',
    type: 'AgentDiagram',
    nodes,
    edges: [],
    assessments: {},
  }) as unknown as UMLModel;

describe('toAgentLLMElement', () => {
  it('applies the v3 deserialize defaults for missing fields', () => {
    const element = toAgentLLMElement(llmNode('llm-1', 'fast'));
    expect(element).toEqual({
      id: 'llm-1',
      type: 'AgentLLM',
      name: 'fast',
      provider: 'openai',
      parameters: {},
      num_previous_messages: 1,
      global_context: '',
    });
  });

  it('keeps explicit fields and rejects unknown providers', () => {
    const element = toAgentLLMElement(
      llmNode('llm-2', 'big', {
        provider: 'bogus',
        parameters: { model: 'gpt-4o' },
        num_previous_messages: 5,
        global_context: 'ctx',
      }),
    );
    expect(element.provider).toBe('openai');
    expect(element.parameters).toEqual({ model: 'gpt-4o' });
    expect(element.num_previous_messages).toBe(5);
    expect(element.global_context).toBe('ctx');
  });
});

describe('listAgentLLMElements / isAgentLLMNode', () => {
  it('returns only AgentLLM nodes, in node order', () => {
    const other = { ...llmNode('state-1', 'state'), type: 'AgentState' } as unknown as BesserNode;
    const model = modelWith([llmNode('llm-1', 'fast'), other, llmNode('llm-2', 'big')]);
    expect(listAgentLLMElements(model).map((l) => l.name)).toEqual(['fast', 'big']);
    expect(isAgentLLMNode(other)).toBe(false);
  });

  it('tolerates null / missing models', () => {
    expect(listAgentLLMElements(null)).toEqual([]);
    expect(listAgentLLMElements(undefined)).toEqual([]);
  });
});

describe('createAgentLLMNode', () => {
  it('builds the develop default node, stacked below existing rows', () => {
    const node = createAgentLLMNode(2);
    expect(node.type).toBe('AgentLLM');
    expect(node.position).toEqual({ x: 40, y: 40 + 2 * 110 });
    expect(node.width).toBe(200);
    expect(node.height).toBe(90);
    expect(node.data).toEqual({
      name: 'gpt-4o-mini',
      provider: 'openai',
      parameters: {},
      num_previous_messages: 1,
      global_context: '',
    });
    expect(node.id).toBeTruthy();
  });
});

describe('applyAgentLLMPatch', () => {
  it('merges data fields and pins id/type', () => {
    const node = llmNode('llm-1', 'fast');
    const next = applyAgentLLMPatch(node, { id: 'evil', name: 'renamed', num_previous_messages: 9 } as never);
    expect(next.id).toBe('llm-1');
    expect(next.type).toBe('AgentLLM');
    expect((next.data as { name?: string }).name).toBe('renamed');
    expect((next.data as { num_previous_messages?: number }).num_previous_messages).toBe(9);
  });
});

describe('remapLlmReferences', () => {
  const buildNodes = (): BesserNode[] => [
    llmNode('llm-1', 'fast'),
    {
      id: 'rag-1',
      type: 'AgentRagElement',
      position: { x: 0, y: 0 },
      width: 120,
      height: 110,
      measured: { width: 120, height: 110 },
      data: { name: 'manuals', llm_name: 'fast' },
    } as unknown as BesserNode,
    {
      id: 'rs-1',
      type: 'AgentReasoningState',
      position: { x: 0, y: 0 },
      width: 200,
      height: 80,
      measured: { width: 200, height: 80 },
      data: { name: 'reason', llm_name: 'fast' },
    } as unknown as BesserNode,
    {
      id: 'state-1',
      type: 'AgentState',
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      measured: { width: 200, height: 100 },
      data: {
        name: 'answer',
        bodies: [
          { id: 'b1', name: 'AI response', replyType: 'llm', llm_name: 'fast' },
          { id: 'b2', name: 'other', replyType: 'llm', llm_name: 'big' },
        ],
        fallbackBodies: [{ id: 'f1', name: 'db', replyType: 'db_reply', llm_name: 'fast' }],
      },
    } as unknown as BesserNode,
  ];

  it('renames every reference, including inline body rows', () => {
    const nodes = buildNodes();
    remapLlmReferences(nodes, 'fast', 'speedy');
    expect((nodes[1].data as { llm_name?: string }).llm_name).toBe('speedy');
    expect((nodes[2].data as { llm_name?: string }).llm_name).toBe('speedy');
    const stateData = nodes[3].data as {
      bodies: Array<{ llm_name?: string }>;
      fallbackBodies: Array<{ llm_name?: string }>;
    };
    expect(stateData.bodies[0].llm_name).toBe('speedy');
    expect(stateData.bodies[1].llm_name).toBe('big');
    expect(stateData.fallbackBodies[0].llm_name).toBe('speedy');
  });

  it('clears references on delete (empty string = "use default")', () => {
    const nodes = buildNodes();
    remapLlmReferences(nodes, 'fast', '');
    expect((nodes[1].data as { llm_name?: string }).llm_name).toBe('');
    expect((nodes[2].data as { llm_name?: string }).llm_name).toBe('');
    const stateData = nodes[3].data as { bodies: Array<{ llm_name?: string }> };
    expect(stateData.bodies[0].llm_name).toBe('');
  });

  it('never touches the AgentLLM definition node itself', () => {
    const nodes = buildNodes();
    remapLlmReferences(nodes, 'fast', 'speedy');
    expect((nodes[0].data as { name?: string }).name).toBe('fast');
  });
});

describe('resolveDefaultLlm', () => {
  it('returns undefined when no LLM is defined', () => {
    expect(resolveDefaultLlm(modelWith([]), 'stale')).toBeUndefined();
  });

  it('forces the single LLM to be the default', () => {
    const model = modelWith([llmNode('llm-1', 'fast')]);
    expect(resolveDefaultLlm(model, undefined)).toBe('fast');
    expect(resolveDefaultLlm(model, 'stale')).toBe('fast');
  });

  it('keeps a still-valid default with multiple LLMs', () => {
    const model = modelWith([llmNode('llm-1', 'fast'), llmNode('llm-2', 'big')]);
    expect(resolveDefaultLlm(model, 'big')).toBe('big');
  });

  it('falls back to the first LLM when the default is stale', () => {
    const model = modelWith([llmNode('llm-1', 'fast'), llmNode('llm-2', 'big')]);
    expect(resolveDefaultLlm(model, 'gone')).toBe('fast');
  });
});
