/**
 * Agent diagram load path (v3 → v4).
 *
 * Ported from smart-gen's old-editor test (ApollonEditor load path / Svg export):
 * the React Flow editor loads v4, so the equivalent guarantee is that the v3 → v4
 * migrator moves legacy canvas components into `model.components` and carries a
 * v3 `model.components` map over verbatim, never emitting component nodes that the
 * canvas (or the SVG export) would have to render.
 */
import { convertV3ToV4, normalizeAgentComponents, UMLModel } from '@besser/wme';

type AnyRecord = Record<string, any>;

const bounds = (x = 0, y = 0) => ({ x, y, width: 160, height: 60 });

// Old develop-format agent model: an intent (with a training sentence) and a tool on the canvas.
function legacyAgentModel(): AnyRecord {
  return {
    version: '3.0.0',
    type: 'AgentDiagram',
    size: { width: 800, height: 600 },
    interactive: { elements: {}, relationships: {} },
    assessments: {},
    relationships: {},
    elements: {
      intent1: { id: 'intent1', name: 'greet', type: 'AgentIntent', owner: null, bounds: bounds(), bodies: ['ib1'], intent_description: '' },
      ib1: { id: 'ib1', name: 'hi', type: 'AgentIntentBody', owner: 'intent1', bounds: bounds(0, 40) },
      tool1: { id: 'tool1', name: 'search', type: 'AgentTool', owner: null, bounds: bounds(300, 0) },
    },
  };
}

// Smart-generator v3 format: canvas elements + an off-canvas `components` map.
function componentsFormatAgentModel(): AnyRecord {
  return {
    ...legacyAgentModel(),
    elements: {
      state1: { id: 'state1', name: 'Idle', type: 'AgentState', owner: null, bounds: bounds(), bodies: [], fallbackBodies: [] },
    },
    components: {
      llm1: { id: 'llm1', name: 'gpt', type: 'AgentLLM', owner: null, provider: 'openai', parameters: {} },
      gui1: { id: 'gui1', name: 'signup', type: 'AgentGUI', owner: null, gui_id: 'signup', is_form: true, persist: true },
    },
  };
}

const toV4 = (model: AnyRecord): UMLModel => normalizeAgentComponents(convertV3ToV4(model as any));

describe('agent diagram v3 → v4 load path', () => {
  it('moves legacy canvas components out of the nodes', () => {
    const model = toV4(legacyAgentModel());
    expect(model.nodes).toEqual([]);
    expect(Object.keys(model.components ?? {}).sort()).toEqual(['ib1', 'intent1', 'tool1']);
    expect(model.components?.intent1).not.toHaveProperty('bounds');
    expect(model.components?.intent1).toMatchObject({ bodies: ['ib1'] });
    expect(model.components?.ib1).toMatchObject({ owner: 'intent1', name: 'hi' });
  });

  it('carries a v3 components map over verbatim next to the canvas nodes', () => {
    const input = componentsFormatAgentModel();
    const model = toV4(input);
    expect(model.nodes.map((n) => n.id)).toEqual(['state1']);
    expect(model.components).toEqual(input.components);
  });
});
