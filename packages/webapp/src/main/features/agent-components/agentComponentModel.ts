/**
 * Pure helpers for the agent components stored in `model.components` of an
 * AgentDiagram. No React, no storage: the components panel hook composes these,
 * and they are unit-tested on their own.
 */
import { v4 as uuidv4 } from 'uuid';
import { AgentComponentType, UMLModelComponent } from '@besser/wme';

export type AgentComponents = { [id: string]: UMLModelComponent };

export type CreatableComponentType = Exclude<AgentComponentType, typeof AgentComponentType.AgentIntentBody>;

/** Fields every new component of a given type starts with (what the panel writes on "Add"). */
const COMPONENT_DEFAULTS: { [T in CreatableComponentType]: () => Record<string, unknown> } = {
  [AgentComponentType.AgentLLM]: () => ({ provider: 'openai', parameters: {}, num_previous_messages: 1, global_context: '' }),
  [AgentComponentType.AgentIntent]: () => ({ intent_description: '', bodies: [] }),
  [AgentComponentType.AgentTool]: () => ({ description: '', code: DEFAULT_TOOL_CODE }),
  [AgentComponentType.AgentSkill]: () => ({ description: '', content: '' }),
  [AgentComponentType.AgentWorkspace]: () => ({ path: '', description: '', writable: true, max_read_bytes: 200000 }),
  [AgentComponentType.AgentRagElement]: () => ({
    llm_name: '',
    llm_prompt: '',
    k: 4,
    num_previous_messages: 0,
    embedding_provider: 'openai',
    embedding_base_url: '',
    embedding_model: '',
  }),
  [AgentComponentType.AgentGUI]: () => ({ gui_id: uuidv4(), persist: true, width: '', is_form: false, guiModel: null }),
};

export const DEFAULT_TOOL_CODE = 'def tool_name(session):\n    pass\n';

/** A new, unnamed, off-canvas component of `type` with its default fields. */
export function createAgentComponent(type: CreatableComponentType): UMLModelComponent {
  return {
    id: uuidv4(),
    type: type as UMLModelComponent['type'],
    name: '',
    owner: null,
    ...COMPONENT_DEFAULTS[type](),
  };
}

export function componentsOfType(components: AgentComponents, type: AgentComponentType): UMLModelComponent[] {
  return Object.values(components).filter((component) => (component.type as string) === type);
}

/** Components are off-canvas: never persist a position. */
export function stripBounds(components: AgentComponents): AgentComponents {
  const stripped: AgentComponents = {};
  for (const [id, component] of Object.entries(components)) {
    const { bounds: _bounds, ...rest } = component;
    stripped[id] = rest as UMLModelComponent;
  }
  return stripped;
}

/** Remove a component together with the components it owns (e.g. an intent's training sentences). */
export function removeComponent(components: AgentComponents, id: string): AgentComponents {
  const next: AgentComponents = {};
  for (const [key, component] of Object.entries(components)) {
    if (key !== id && component.owner !== id) next[key] = component;
  }
  return next;
}

export function intentBodyIds(intent: UMLModelComponent): string[] {
  if (Array.isArray(intent.bodies)) return intent.bodies;
  return Array.isArray(intent.ownedElements) ? intent.ownedElements : [];
}

export function addIntentBody(components: AgentComponents, intentId: string, bodyId: string = uuidv4()): AgentComponents {
  const intent = components[intentId];
  if (!intent) return components;
  const body: UMLModelComponent = {
    id: bodyId,
    type: AgentComponentType.AgentIntentBody as UMLModelComponent['type'],
    name: '',
    owner: intentId,
  };
  return { ...components, [bodyId]: body, [intentId]: { ...intent, bodies: [...intentBodyIds(intent), bodyId] } };
}

export function removeIntentBody(components: AgentComponents, intentId: string, bodyId: string): AgentComponents {
  const intent = components[intentId];
  if (!intent) return components;
  const next = { ...components };
  delete next[bodyId];
  next[intentId] = { ...intent, bodies: intentBodyIds(intent).filter((id) => id !== bodyId) };
  return next;
}

/**
 * The default LLM (`config.default_llm_name`) after an LLM is renamed.
 *
 * - Renaming the current default keeps it the default (the link is by name).
 * - When no default is set, the first LLM added becomes the default as soon as it has a name.
 *
 * @param llms The LLM components in insertion order, before the rename.
 */
export function defaultLlmAfterRename(
  currentDefault: string,
  llms: UMLModelComponent[],
  renamedId: string,
  newName: string,
): string {
  const renamed = llms.find((llm) => llm.id === renamedId);
  if (!renamed) return currentDefault;
  if (currentDefault && currentDefault === renamed.name) return newName;
  if (!currentDefault && llms[0]?.id === renamedId && newName) return newName;
  return currentDefault;
}
