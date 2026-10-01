import { ApollonEditor, UMLDiagramType, UMLModel } from '@besser/wme';
import { Svg } from '../../../../editor/src/main/scenes/svg';
import {
  AgentStateTransition,
  LEGACY_TRANSITION_PREDEFINED_TYPE,
  NEW_TRANSITION_PREDEFINED_TYPE,
} from '../../../../editor/src/main/packages/agent-state-diagram/agent-state-transition/agent-state-transition';

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

describe('agent diagram SVG export', () => {
  beforeAll(() => {
    // jsdom has no SVG layout; text measuring (Text.size) needs getBBox.
    if (!(SVGElement.prototype as any).getBBox) {
      (SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 50, height: 16 });
    }
  });

  it('does not throw on data-only elements whose render() returns nothing', () => {
    // AgentIntent / AgentTool render() return [] (they live in the components panel);
    // the export used to crash destructuring an undefined root.
    const svg = new Svg({ model: legacyAgentModel() as UMLModel });
    expect(svg.state.elements).toEqual([]);
  });
});

describe('ApollonEditor agent load path', () => {
  it('moves legacy components out of the canvas and hands them to the host once', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new ApollonEditor(container, {
      type: UMLDiagramType.AgentDiagram,
      model: legacyAgentModel() as UMLModel,
    });
    try {
      await editor.nextRender;
      const model = editor.model;
      expect(Object.keys(model.elements)).toEqual([]);
      expect(Object.keys(model.components ?? {}).sort()).toEqual(['ib1', 'intent1', 'tool1']);
      expect(model.components?.intent1).not.toHaveProperty('bounds');
    } finally {
      editor.destroy();
      container.remove();
    }
  });
});

describe('AgentStateTransition condition defaults', () => {
  it('starts a newly drawn transition as "auto"', () => {
    expect(new AgentStateTransition().predefinedType).toBe(NEW_TRANSITION_PREDEFINED_TYPE);
    expect(NEW_TRANSITION_PREDEFINED_TYPE).toBe('auto');
  });

  it('keeps loading stored transitions without a condition as intent matches', () => {
    const transition = new AgentStateTransition();
    transition.deserialize({
      id: 't1',
      name: '',
      type: 'AgentStateTransition',
      owner: null,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      source: { element: 'a', direction: 'Right' },
      target: { element: 'b', direction: 'Left' },
      path: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      isManuallyLayouted: false,
    } as any);
    expect(transition.predefinedType).toBe(LEGACY_TRANSITION_PREDEFINED_TYPE);
    expect(transition.serialize().predefined?.predefinedType).toBe('when_intent_matched');
  });
});
