import { DeepPartial } from 'redux';
import { AgentElementType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import * as Apollon from '../../../typings';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary } from '../../../utils/geometry/boundary';
import { UMLElementType } from '../../uml-element-type';

/**
 * Canonical LLM provider keys, in dropdown order.
 *
 * Single source of truth for the editor and the webapp: the union type below and
 * every runtime whitelist derive from this array, so adding a provider is a
 * one-line change here rather than an edit to seven hand-maintained lists.
 *
 * Must stay in sync with `Agent._LLM_PROVIDERS` in the BESSER backend
 * (`besser/BUML/metamodel/state_machine/agent.py`).
 */
export const AGENT_LLM_PROVIDERS = [
  'openai',
  'huggingface',
  'huggingface_api',
  'replicate',
  'ollama',
  'mistral',
  'deepseek',
  'google',
  'meta',
  'anthropic',
  'qwen',
  'xai',
  'groq',
  'together',
  'openrouter',
] as const;

export type AgentLLMProviderType = (typeof AGENT_LLM_PROVIDERS)[number];

/**
 * Provider spellings written by older builds and still present in saved configs.
 * They are accepted on read so an existing selection is never silently reset to
 * the default; the value on the right is the canonical key they correspond to.
 */
export const LEGACY_AGENT_LLM_PROVIDER_ALIASES = {
  huggingfaceapi: 'huggingface_api',
} as const;

export type LegacyAgentLLMProviderType = keyof typeof LEGACY_AGENT_LLM_PROVIDER_ALIASES;

/** Every provider spelling accepted on read: canonical keys plus legacy aliases. */
export const ACCEPTED_AGENT_LLM_PROVIDERS: readonly string[] = [
  ...AGENT_LLM_PROVIDERS,
  ...Object.keys(LEGACY_AGENT_LLM_PROVIDER_ALIASES),
];

/** True when `value` is a provider key this build accepts (canonical or legacy). */
export const isAcceptedAgentLLMProvider = (
  value: unknown,
): value is AgentLLMProviderType | LegacyAgentLLMProviderType =>
  typeof value === 'string' && ACCEPTED_AGENT_LLM_PROVIDERS.includes(value);

/**
 * Providers whose runtime wrapper does not expose a chat-completion API, so a
 * chat action cannot target them. Everything else in AGENT_LLM_PROVIDERS does.
 */
export const NON_CHAT_AGENT_LLM_PROVIDERS: readonly string[] = ['huggingface_api', 'replicate'];

/**
 * Map any accepted spelling onto its canonical key, falling back to `fallback`
 * for unknown input. Legacy aliases are accepted on read and normalised here so
 * the rest of the app only ever handles canonical keys.
 */
export const canonicalizeAgentLLMProvider = (
  value: unknown,
  fallback: AgentLLMProviderType = 'openai',
): AgentLLMProviderType => {
  if (typeof value !== 'string') return fallback;
  if ((AGENT_LLM_PROVIDERS as readonly string[]).includes(value)) return value as AgentLLMProviderType;
  return (
    (LEGACY_AGENT_LLM_PROVIDER_ALIASES as Record<string, AgentLLMProviderType>)[value] ?? fallback
  );
};

export interface IAgentLLM extends IUMLElement {
  provider: AgentLLMProviderType;
  parameters: Record<string, unknown>;
  num_previous_messages: number;
  global_context: string;
}

export class AgentLLM extends UMLElement implements IAgentLLM {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    resizable: false,
    droppable: false,
    selectable: false,
    movable: false,
    hoverable: false,
    connectable: false,
    updatable: false,
  };

  type: UMLElementType = AgentElementType.AgentLLM;
  provider: AgentLLMProviderType = 'openai';
  parameters: Record<string, unknown> = {};
  num_previous_messages: number = 1;
  global_context: string = '';

  bounds: IBoundary = { x: 0, y: 0, width: 0, height: 0 };

  constructor(values?: DeepPartial<IAgentLLM>) {
    super(values);
    assign<IAgentLLM>(this, values);
    if (!this.name) {
      this.name = '';
    }
    if (!this.provider) {
      this.provider = 'openai';
    }
    if (!this.parameters || typeof this.parameters !== 'object') {
      this.parameters = {};
    }
    if (typeof this.num_previous_messages !== 'number') {
      this.num_previous_messages = 1;
    }
    if (typeof this.global_context !== 'string') {
      this.global_context = '';
    }
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  serialize(children?: UMLElement[]): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      provider: this.provider,
      parameters: this.parameters,
      num_previous_messages: this.num_previous_messages,
      global_context: this.global_context,
    } as Apollon.UMLModelElement & {
      provider: AgentLLMProviderType;
      parameters: Record<string, unknown>;
      num_previous_messages: number;
      global_context: string;
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & {
      provider?: AgentLLMProviderType;
      parameters?: Record<string, unknown>;
      num_previous_messages?: number;
      global_context?: string | null;
    },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.provider = (values.provider as AgentLLMProviderType) || 'openai';
    this.parameters =
      values.parameters && typeof values.parameters === 'object' ? values.parameters : {};
    this.num_previous_messages =
      typeof values.num_previous_messages === 'number' ? values.num_previous_messages : 1;
    this.global_context = values.global_context == null ? '' : String(values.global_context);
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  render(layer: ILayer): ILayoutable[] {
    return [];
  }
}
