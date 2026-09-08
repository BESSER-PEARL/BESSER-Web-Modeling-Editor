import { normalizeAgentModel } from '@besser/wme';
import { LocalStorageRepository } from '../local-storage-repository';
import { localStorageAgentBaseModels } from '../../../constants/constant';

// Mock react-toastify (imported transitively by localStorageQuota).
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

type AnyModel = Record<string, any>;

function flatTransition(id: string, condition: string, conditionValue: unknown): AnyModel {
  return {
    id,
    name: '',
    type: 'AgentStateTransition',
    owner: null,
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    source: { element: `${id}-src`, direction: 'Right' },
    target: { element: `${id}-tgt`, direction: 'Left' },
    path: [{ x: 0, y: 0 }],
    isManuallyLayouted: false,
    condition,
    conditionValue,
  };
}

function agentModel(relationships: Record<string, AnyModel>): AnyModel {
  return {
    version: '3.0.0',
    type: 'AgentDiagram',
    size: { width: 100, height: 100 },
    elements: {},
    interactive: { elements: {}, relationships: {} },
    relationships,
    assessments: {},
  };
}

describe('normalizeAgentModel', () => {
  it('upgrades a flat when_intent_matched transition to the nested shape', () => {
    const out = normalizeAgentModel(
      agentModel({ r1: flatTransition('r1', 'when_intent_matched', 'Greeting_intent') }) as any,
    );
    const rel = out.relationships.r1 as AnyModel;

    expect(rel.transitionType).toBe('predefined');
    expect(rel.predefined.predefinedType).toBe('when_intent_matched');
    expect(rel.predefined.intentName).toBe('Greeting_intent');
    // Flat keys are gone.
    expect('condition' in rel).toBe(false);
    expect('conditionValue' in rel).toBe(false);
  });

  it('upgrades when_no_intent_matched and auto transitions', () => {
    const out = normalizeAgentModel(
      agentModel({
        a: flatTransition('a', 'when_no_intent_matched', ''),
        b: flatTransition('b', 'auto', ''),
      }) as any,
    );

    expect((out.relationships.a as AnyModel).predefined.predefinedType).toBe('when_no_intent_matched');
    expect((out.relationships.b as AnyModel).predefined.predefinedType).toBe('auto');
  });

  it('maps an object conditionValue onto variable-operation fields', () => {
    const out = normalizeAgentModel(
      agentModel({
        v: flatTransition('v', 'when_variable_operation_matched', {
          variable: 'count',
          operator: '>',
          targetValue: '3',
        }),
      }) as any,
    );
    const predefined = (out.relationships.v as AnyModel).predefined;

    expect(predefined.predefinedType).toBe('when_variable_operation_matched');
    expect(predefined.conditionValue).toEqual({ variable: 'count', operator: '>', targetValue: '3' });
  });

  it('preserves the relationship id and endpoints', () => {
    const out = normalizeAgentModel(
      agentModel({ r1: flatTransition('r1', 'when_intent_matched', 'X') }) as any,
    );
    const rel = out.relationships.r1 as AnyModel;

    expect(rel.id).toBe('r1');
    expect(rel.source.element).toBe('r1-src');
    expect(rel.target.element).toBe('r1-tgt');
  });

  it('is idempotent on already-nested input', () => {
    const once = normalizeAgentModel(
      agentModel({ r1: flatTransition('r1', 'when_intent_matched', 'X') }) as any,
    );
    const twice = normalizeAgentModel(once);

    expect(twice.relationships.r1).toEqual(once.relationships.r1);
  });

  it('does not touch AgentStateTransitionInit relationships', () => {
    const init = {
      id: 'init',
      name: '',
      type: 'AgentStateTransitionInit',
      owner: null,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      source: { element: 's' },
      target: { element: 't' },
      path: [],
      isManuallyLayouted: false,
    };
    const out = normalizeAgentModel(agentModel({ init }) as any);

    expect(out.relationships.init).toEqual(init);
  });

  it('does not mutate the input model', () => {
    const input = agentModel({ r1: flatTransition('r1', 'auto', '') });
    normalizeAgentModel(input as any);

    expect((input.relationships.r1 as AnyModel).condition).toBe('auto');
  });
});

describe('agent base model storage normalization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveAgentBaseModel normalizes a flat model before persisting', () => {
    LocalStorageRepository.saveAgentBaseModel(
      'diagram-1',
      agentModel({ r1: flatTransition('r1', 'when_intent_matched', 'Greeting_intent') }) as any,
    );

    const stored = LocalStorageRepository.getAgentBaseModel('diagram-1') as AnyModel;
    const rel = stored.relationships.r1 as AnyModel;
    expect(rel.predefined.predefinedType).toBe('when_intent_matched');
    expect(rel.predefined.intentName).toBe('Greeting_intent');
    expect('condition' in rel).toBe(false);
  });

  it('migrateToV4 normalizes a flat snapshot already in localStorage', () => {
    // Seed localStorage directly with a legacy flat snapshot (bypassing the
    // normalizing write path, simulating a project imported before the fix).
    localStorage.setItem(
      localStorageAgentBaseModels,
      JSON.stringify({
        'diagram-1': agentModel({ r1: flatTransition('r1', 'when_intent_matched', 'Greeting_intent') }),
      }),
    );

    LocalStorageRepository.migrateToV4();

    const migrated = LocalStorageRepository.getAgentBaseModel('diagram-1') as AnyModel;
    const rel = migrated.relationships.r1 as AnyModel;
    expect(rel.predefined.predefinedType).toBe('when_intent_matched');
    expect('condition' in rel).toBe(false);
  });
});
