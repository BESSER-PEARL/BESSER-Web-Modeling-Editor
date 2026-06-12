import type { BesserNode, UMLModel } from '@besser/wme';

/**
 * Multi-LLM helpers for the Agent Customization panel (LLMs card).
 *
 * Develop source: the inline helpers in
 * `features/agent-config/AgentConfigurationPanel.tsx` (AgentLLMElement,
 * remapLlmReferences, resolveDefaultLlm, …). Ported behavior, v4 shape:
 * AgentLLM definitions live as **data-only nodes** (`type: 'AgentLLM'`)
 * in the canonical v4 `model.nodes` array — never rendered on the
 * canvas (the library registers a null-rendering component), managed
 * exclusively from the Customization panel.
 */

export type AgentLLMElementProvider = 'openai' | 'huggingface' | 'huggingface_api' | 'replicate';

/** Flat UI view of an `AgentLLM` node — the shape the LLMs card edits. */
export type AgentLLMElement = {
  id: string;
  type: 'AgentLLM';
  name: string;
  provider: AgentLLMElementProvider;
  parameters: Record<string, unknown>;
  num_previous_messages: number;
  global_context: string | null;
};

export const AGENT_LLM_PROVIDER_OPTIONS: Array<{ value: AgentLLMElementProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'huggingface', label: 'Hugging Face' },
  { value: 'huggingface_api', label: 'Hugging Face API' },
  { value: 'replicate', label: 'Replicate' },
];

export const generateAgentLLMId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const isAgentLLMNode = (value: unknown): value is BesserNode => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown };
  return candidate.type === 'AgentLLM';
};

/** Normalize a v4 `AgentLLM` node into the flat UI view, applying the
 * v3 deserialize defaults (provider 'openai', parameters {}, 1 previous
 * message, empty global context). */
export const toAgentLLMElement = (node: BesserNode, fallbackId = ''): AgentLLMElement => {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const provider = (['openai', 'huggingface', 'huggingface_api', 'replicate'].includes(
    data.provider as string,
  )
    ? data.provider
    : 'openai') as AgentLLMElementProvider;
  const parameters =
    data.parameters && typeof data.parameters === 'object' && !Array.isArray(data.parameters)
      ? (data.parameters as Record<string, unknown>)
      : {};
  const numPrev = typeof data.num_previous_messages === 'number' ? data.num_previous_messages : 1;
  const globalContext =
    data.global_context == null
      ? ''
      : typeof data.global_context === 'string'
        ? data.global_context
        : String(data.global_context);
  return {
    id: typeof node.id === 'string' && node.id ? node.id : fallbackId,
    type: 'AgentLLM',
    name: typeof data.name === 'string' ? data.name : '',
    provider,
    parameters,
    num_previous_messages: numPrev,
    global_context: globalContext,
  };
};

/** All registered LLM definitions in the model, in node order. */
export const listAgentLLMElements = (model: Pick<UMLModel, 'nodes'> | null | undefined): AgentLLMElement[] => {
  if (!model || !Array.isArray(model.nodes)) return [];
  return model.nodes.filter(isAgentLLMNode).map((node) => toAgentLLMElement(node, node.id));
};

/** Build a fresh v4 `AgentLLM` node. Mirrors develop's add handler:
 * name 'gpt-4o-mini', provider 'openai', stacked below existing rows. */
export const createAgentLLMNode = (existingCount: number): BesserNode => {
  const id = generateAgentLLMId();
  const offsetY = 40 + existingCount * 110;
  return {
    id,
    type: 'AgentLLM' as BesserNode['type'],
    position: { x: 40, y: offsetY },
    width: 200,
    height: 90,
    measured: { width: 200, height: 90 },
    data: {
      name: 'gpt-4o-mini',
      provider: 'openai',
      parameters: {},
      num_previous_messages: 1,
      global_context: '',
    },
  };
};

/** Merge an LLMs-card patch into the node's `data` (id/type pinned). */
export const applyAgentLLMPatch = (node: BesserNode, patch: Partial<AgentLLMElement>): BesserNode => {
  const dataPatch: Record<string, unknown> = { ...patch };
  delete dataPatch.id;
  delete dataPatch.type;
  return {
    ...node,
    type: 'AgentLLM' as BesserNode['type'],
    data: { ...(node.data ?? {}), ...dataPatch },
  };
};

export const formatAgentLLMParameters = (parameters: Record<string, unknown>): string => {
  try {
    return JSON.stringify(parameters ?? {}, null, 2);
  } catch {
    return '{}';
  }
};

// Node types whose data carries an `llm_name` reference to a registered
// AgentLLM. Develop listed the v3 element types (AgentRagElement,
// AgentReasoningState, AgentStateBody, AgentStateFallbackBody); in v4
// the body rows live inline on the parent AgentState's `bodies` /
// `fallbackBodies` arrays, handled separately below.
const LLM_REFERENCING_NODE_TYPES = new Set<string>(['AgentRagElement', 'AgentReasoningState']);

type LlmBodyRow = { llm_name?: string } & Record<string, unknown>;

/**
 * Rewrite every `llm_name === fromName` to `toName` across all nodes
 * (including the inline AgentState body rows), so renaming or removing
 * an AgentLLM propagates fully and never leaves a dangling reference
 * behind. Mutates the passed nodes array in place (callers operate on a
 * deep clone of the model). An empty `toName` means "(use default)".
 */
export const remapLlmReferences = (
  nodes: BesserNode[] | undefined,
  fromName: string,
  toName: string,
): void => {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const data = (node.data ?? {}) as Record<string, unknown>;
    if (LLM_REFERENCING_NODE_TYPES.has(node.type as string) && data.llm_name === fromName) {
      data.llm_name = toName;
      node.data = data;
    }
    if ((node.type as string) === 'AgentState') {
      for (const arrayKey of ['bodies', 'fallbackBodies'] as const) {
        const rows = data[arrayKey];
        if (!Array.isArray(rows)) continue;
        for (const row of rows as LlmBodyRow[]) {
          if (row && typeof row === 'object' && row.llm_name === fromName) {
            row.llm_name = toName;
          }
        }
      }
    }
  }
};

/**
 * Resolve the default LLM that satisfies the invariant
 * "if the list has any LLMs, the default points to one of them; if
 * there is exactly one LLM it must be that one." Pass the model that
 * already reflects the latest CRUD operation.
 */
export const resolveDefaultLlm = (
  model: Pick<UMLModel, 'nodes'> | null | undefined,
  currentDefault: string | undefined,
): string | undefined => {
  const llms = listAgentLLMElements(model);
  if (llms.length === 0) return undefined;
  if (llms.length === 1) return llms[0].name || undefined;
  if (currentDefault && llms.some((l) => l.name === currentDefault)) {
    return currentDefault;
  }
  return llms[0].name || undefined;
};
