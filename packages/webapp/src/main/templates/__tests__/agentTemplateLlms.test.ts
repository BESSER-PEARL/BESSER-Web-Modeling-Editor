import { describe, expect, it } from 'vitest';

// Every LLM-using part of a bundled agent must resolve to an LLM the model defines: a named
// reference must match an AgentLLM, an empty one falls back to the agent's default (first)
// LLM. Without one the generated agent has `default_llm = None` and fails at first use.
const templates = import.meta.glob('../pattern/**/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

const LLM_ACTION_TYPES = new Set(['LLMReplyAction', 'LLMChatAction', 'WebCrawlLLMAction']);
const LLM_REPLY_TYPES = new Set(['llm', 'llm_chat', 'web_crawl_llm']);

interface AgentModelEntry {
  where: string;
  model: any;
  config: any;
}

function collectAgentModels(node: unknown, where: string, config: any, out: AgentModelEntry[]): AgentModelEntry[] {
  if (Array.isArray(node)) {
    node.forEach((child, i) => collectAgentModels(child, `${where}[${i}]`, config, out));
  } else if (node && typeof node === 'object') {
    const obj = node as any;
    const scopeConfig = obj.config && typeof obj.config === 'object' ? obj.config : config;
    if (obj.type === 'AgentDiagram' && obj.elements && typeof obj.elements === 'object') {
      out.push({ where, model: obj, config: scopeConfig });
    }
    for (const [key, child] of Object.entries(obj)) collectAgentModels(child, `${where}/${key}`, scopeConfig, out);
  }
  return out;
}

function llmUsers(model: any): { label: string; llmName: string }[] {
  const entries = Object.values({ ...model.agentComponents, ...model.elements, ...model.components }) as any[];
  return entries
    .filter(
      (e) =>
        LLM_ACTION_TYPES.has(e.actionType) ||
        LLM_REPLY_TYPES.has(e.replyType) ||
        e.type === 'AgentRagElement' ||
        (e.type === 'AgentState' && e.stateType === 'reasoning'),
    )
    .map((e) => ({ label: `${e.type} "${e.name}"`, llmName: String(e.llm_name ?? e.llmName ?? e.llm ?? '').trim() }));
}

function definedLlms(model: any): string[] {
  const entries = Object.values({ ...model.agentComponents, ...model.elements, ...model.components }) as any[];
  return entries.filter((e) => e.type === 'AgentLLM' && e.name).map((e) => e.name);
}

describe('agent template LLMs', () => {
  const models = Object.entries(templates).flatMap(([path, json]) => collectAgentModels(json, path, undefined, []));

  it('finds agent templates', () => {
    expect(models.length).toBeGreaterThan(0);
  });

  it.each(models.map((m) => [m.where, m] as const))('%s references only defined LLMs', (_where, { model, config }) => {
    const llms = definedLlms(model);
    const unresolved = llmUsers(model)
      .filter(({ llmName }) => (llmName ? !llms.includes(llmName) : llms.length === 0))
      .map(({ label, llmName }) => `${label} -> ${llmName || '<default>'}`);
    if (config?.intentRecognitionTechnology === 'llm-based' && llms.length === 0) {
      unresolved.push('LLM intent classifier -> <default>');
    }
    expect(unresolved).toEqual([]);
  });
});
