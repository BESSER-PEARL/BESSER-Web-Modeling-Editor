import { describe, it, expect } from 'vitest';
import { AgentComponentType, UMLModelComponent } from '@besser/wme';
import {
  addIntentBody,
  componentsOfType,
  createAgentComponent,
  defaultLlmAfterRename,
  removeComponent,
  removeIntentBody,
  stripBounds,
} from '../../main/features/agent-components/agentComponentModel';

const llm = (id: string, name: string): UMLModelComponent => ({
  id,
  name,
  type: AgentComponentType.AgentLLM as UMLModelComponent['type'],
  owner: null,
  provider: 'openai',
});

describe('createAgentComponent', () => {
  it('creates an unnamed, off-canvas component with the type defaults', () => {
    const tool = createAgentComponent(AgentComponentType.AgentTool);
    expect(tool).toMatchObject({ type: 'AgentTool', name: '', owner: null, description: '' });
    expect(tool.code).toContain('def tool_name(session)');
    expect(tool.bounds).toBeUndefined();
    expect(tool.id).toBeTruthy();
  });

  it('gives every GUI a fresh gui_id', () => {
    const a = createAgentComponent(AgentComponentType.AgentGUI);
    const b = createAgentComponent(AgentComponentType.AgentGUI);
    expect(a).toMatchObject({ type: 'AgentGUI', persist: true, is_form: false, guiModel: null });
    expect(a.gui_id).toBeTruthy();
    expect(a.gui_id).not.toBe(b.gui_id);
  });

  it('uses the documented defaults for LLMs, workspaces and RAG databases', () => {
    expect(createAgentComponent(AgentComponentType.AgentLLM)).toMatchObject({
      provider: 'openai', parameters: {}, num_previous_messages: 1, global_context: '',
    });
    expect(createAgentComponent(AgentComponentType.AgentWorkspace)).toMatchObject({
      writable: true, max_read_bytes: 200000,
    });
    expect(createAgentComponent(AgentComponentType.AgentRagElement)).toMatchObject({
      k: 4, embedding_provider: 'openai', num_previous_messages: 0,
    });
  });
});

describe('intent training sentences', () => {
  it('adds and removes bodies owned by the intent', () => {
    const intent = createAgentComponent(AgentComponentType.AgentIntent);
    let components = addIntentBody({ [intent.id]: intent }, intent.id, 'b1');
    components = addIntentBody(components, intent.id, 'b2');
    expect(components[intent.id].bodies).toEqual(['b1', 'b2']);
    expect(components.b1).toMatchObject({ type: 'AgentIntentBody', owner: intent.id, name: '' });

    components = removeIntentBody(components, intent.id, 'b1');
    expect(components.b1).toBeUndefined();
    expect(components[intent.id].bodies).toEqual(['b2']);
  });

  it('removing an intent removes its training sentences', () => {
    const intent = createAgentComponent(AgentComponentType.AgentIntent);
    const other = createAgentComponent(AgentComponentType.AgentTool);
    const components = addIntentBody({ [intent.id]: intent, [other.id]: other }, intent.id, 'b1');
    expect(Object.keys(removeComponent(components, intent.id))).toEqual([other.id]);
  });
});

describe('stripBounds / componentsOfType', () => {
  it('drops bounds and filters by type', () => {
    const components = {
      a: { ...llm('a', 'gpt'), bounds: { x: 1, y: 2, width: 3, height: 4 } },
      b: createAgentComponent(AgentComponentType.AgentSkill),
    };
    const stripped = stripBounds(components);
    expect(stripped.a.bounds).toBeUndefined();
    expect(componentsOfType(stripped, AgentComponentType.AgentLLM).map((c) => c.id)).toEqual(['a']);
  });
});

describe('defaultLlmAfterRename (default LLM rule)', () => {
  it('makes the first LLM the default once it is named, when no default is set', () => {
    const llms = [llm('first', ''), llm('second', '')];
    expect(defaultLlmAfterRename('', llms, 'first', 'gpt-4o')).toBe('gpt-4o');
  });

  it('does not make a later LLM the default', () => {
    const llms = [llm('first', ''), llm('second', '')];
    expect(defaultLlmAfterRename('', llms, 'second', 'mistral')).toBe('');
  });

  it('keeps the default when another default is already set', () => {
    const llms = [llm('first', 'gpt-4o'), llm('second', 'x')];
    expect(defaultLlmAfterRename('gpt-4o', llms, 'second', 'mistral')).toBe('gpt-4o');
  });

  it('follows a rename of the default LLM', () => {
    const llms = [llm('first', 'gpt-4'), llm('second', 'x')];
    expect(defaultLlmAfterRename('gpt-4', llms, 'first', 'gpt-4o')).toBe('gpt-4o');
  });

  it('does not set an empty name as default', () => {
    expect(defaultLlmAfterRename('', [llm('first', 'g')], 'first', '')).toBe('');
  });
});
