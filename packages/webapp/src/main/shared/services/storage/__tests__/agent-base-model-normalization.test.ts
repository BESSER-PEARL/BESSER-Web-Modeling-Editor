import { normalizeUmlModelSnapshot } from '../migrate-uml-v3-to-v4';
import { LocalStorageRepository } from '../local-storage-repository';
import {
  localStorageAgentBaseModels,
  localStorageAgentConfigurations,
  localStorageUserProfiles,
} from '../../../constants/constant';
import { isUMLModel } from '../../../types/project';

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

/** Develop-era v3 AgentDiagram model (elements/relationships records). */
function agentModelV3(relationships: Record<string, AnyModel>): AnyModel {
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

const findEdge = (model: AnyModel, id: string): AnyModel =>
  model.edges.find((edge: AnyModel) => edge.id === id);

describe('normalizeUmlModelSnapshot', () => {
  it('lifts a v3 flat when_intent_matched transition to a v4 edge with nested data', () => {
    const out = normalizeUmlModelSnapshot(
      agentModelV3({ r1: flatTransition('r1', 'when_intent_matched', 'Greeting_intent') }) as any,
    ) as AnyModel;

    expect(out.version).toBe('4.0.0');
    expect(Array.isArray(out.nodes)).toBe(true);
    expect(Array.isArray(out.edges)).toBe(true);

    const edge = findEdge(out, 'r1');
    expect(edge.type).toBe('AgentStateTransition');
    expect(edge.data.transitionType).toBe('predefined');
    expect(edge.data.predefined.predefinedType).toBe('when_intent_matched');
    expect(edge.data.predefined.intentName).toBe('Greeting_intent');
    // Flat keys are gone from the canonical edge data.
    expect('condition' in edge.data).toBe(false);
    expect('conditionValue' in edge.data).toBe(false);
  });

  it('lifts when_no_intent_matched and auto transitions', () => {
    const out = normalizeUmlModelSnapshot(
      agentModelV3({
        a: flatTransition('a', 'when_no_intent_matched', ''),
        b: flatTransition('b', 'auto', ''),
      }) as any,
    ) as AnyModel;

    expect(findEdge(out, 'a').data.predefined.predefinedType).toBe('when_no_intent_matched');
    expect(findEdge(out, 'b').data.predefined.predefinedType).toBe('auto');
  });

  it('maps an object conditionValue onto variable-operation fields', () => {
    const out = normalizeUmlModelSnapshot(
      agentModelV3({
        v: flatTransition('v', 'when_variable_operation_matched', {
          variable: 'count',
          operator: '>',
          targetValue: '3',
        }),
      }) as any,
    ) as AnyModel;
    const predefined = findEdge(out, 'v').data.predefined;

    expect(predefined.predefinedType).toBe('when_variable_operation_matched');
    expect(predefined.conditionValue).toEqual({ variable: 'count', operator: '>', targetValue: '3' });
  });

  it('preserves the edge id and endpoints', () => {
    const out = normalizeUmlModelSnapshot(
      agentModelV3({ r1: flatTransition('r1', 'when_intent_matched', 'X') }) as any,
    ) as AnyModel;
    const edge = findEdge(out, 'r1');

    expect(edge.id).toBe('r1');
    expect(edge.source).toBe('r1-src');
    expect(edge.target).toBe('r1-tgt');
  });

  it('is idempotent on already-canonical v4 input', () => {
    const once = normalizeUmlModelSnapshot(
      agentModelV3({ r1: flatTransition('r1', 'when_intent_matched', 'X') }) as any,
    ) as AnyModel;
    const twice = normalizeUmlModelSnapshot(structuredClone(once)) as AnyModel;

    expect(twice.version).toBe('4.0.0');
    expect(findEdge(twice, 'r1')).toEqual(findEdge(once, 'r1'));
  });

  it('does not lift AgentStateTransitionInit data', () => {
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
    const out = normalizeUmlModelSnapshot(agentModelV3({ init }) as any) as AnyModel;
    const edge = findEdge(out, 'init');

    expect(edge.type).toBe('AgentStateTransitionInit');
    expect(edge.data?.transitionType).toBeUndefined();
  });

  it('does not mutate the input model', () => {
    const input = agentModelV3({ r1: flatTransition('r1', 'auto', '') });
    normalizeUmlModelSnapshot(input as any);

    expect((input.relationships.r1 as AnyModel).condition).toBe('auto');
    expect(input.version).toBe('3.0.0');
  });

  it('passes through null / non-object / unknown shapes untouched', () => {
    expect(normalizeUmlModelSnapshot(null)).toBeNull();
    expect(normalizeUmlModelSnapshot(undefined)).toBeUndefined();
    const guiModel = { pages: [] };
    expect(normalizeUmlModelSnapshot(guiModel)).toBe(guiModel);
  });
});

describe('agent base model storage normalization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveAgentBaseModel lifts a v3 model before persisting', () => {
    LocalStorageRepository.saveAgentBaseModel(
      'diagram-1',
      agentModelV3({ r1: flatTransition('r1', 'when_intent_matched', 'Greeting_intent') }) as any,
    );

    const stored = LocalStorageRepository.getAgentBaseModel('diagram-1') as AnyModel;
    expect(stored.version).toBe('4.0.0');
    expect(isUMLModel(stored)).toBe(true);
    const edge = findEdge(stored, 'r1');
    expect(edge.data.predefined.predefinedType).toBe('when_intent_matched');
    expect(edge.data.predefined.intentName).toBe('Greeting_intent');
    expect('condition' in edge.data).toBe(false);
  });

  it('migrateToV4 lifts a v3 base-model snapshot already in localStorage', () => {
    // Seed localStorage directly with a legacy v3 snapshot (bypassing the
    // normalizing write path, simulating a project imported before the fix).
    localStorage.setItem(
      localStorageAgentBaseModels,
      JSON.stringify({
        'diagram-1': agentModelV3({ r1: flatTransition('r1', 'when_intent_matched', 'Greeting_intent') }),
      }),
    );

    LocalStorageRepository.migrateToV4();

    const migrated = LocalStorageRepository.getAgentBaseModel('diagram-1') as AnyModel;
    expect(migrated.version).toBe('4.0.0');
    expect(findEdge(migrated, 'r1').data.predefined.predefinedType).toBe('when_intent_matched');
  });

  it('migrateToV4 lifts v3 user-profile and configuration snapshots', () => {
    const v3UserModel = {
      version: '3.0.0',
      type: 'UserDiagram',
      size: { width: 10, height: 10 },
      elements: {},
      relationships: {},
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    };
    localStorage.setItem(
      localStorageUserProfiles,
      JSON.stringify([{ id: 'p1', name: 'Teen', savedAt: new Date().toISOString(), model: v3UserModel }]),
    );
    localStorage.setItem(
      localStorageAgentConfigurations,
      JSON.stringify([
        {
          id: 'c1',
          name: 'Config',
          savedAt: new Date().toISOString(),
          config: {},
          baseAgentModel: agentModelV3({ r1: flatTransition('r1', 'auto', '') }),
          originalAgentModel: agentModelV3({ r1: flatTransition('r1', 'auto', '') }),
          personalizedAgentModel: null,
        },
      ]),
    );

    LocalStorageRepository.migrateToV4();

    const [profile] = LocalStorageRepository.getUserProfiles();
    expect((profile.model as AnyModel).version).toBe('4.0.0');
    expect(isUMLModel(profile.model)).toBe(true);

    const [config] = LocalStorageRepository.getAgentConfigurations();
    expect((config.baseAgentModel as AnyModel).version).toBe('4.0.0');
    expect((config.originalAgentModel as AnyModel).version).toBe('4.0.0');
    expect(config.personalizedAgentModel).toBeNull();
  });

  it('migrateToV4 is a no-op on empty stores and idempotent on v4 data', () => {
    LocalStorageRepository.migrateToV4();
    expect(localStorage.getItem(localStorageAgentBaseModels)).toBeNull();

    LocalStorageRepository.saveAgentBaseModel(
      'diagram-1',
      agentModelV3({ r1: flatTransition('r1', 'auto', '') }) as any,
    );
    const before = LocalStorageRepository.getAgentBaseModel('diagram-1');
    LocalStorageRepository.migrateToV4();
    expect(LocalStorageRepository.getAgentBaseModel('diagram-1')).toEqual(before);
  });
});

describe('mergeImportedPersonalization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('appends new entries, lifting v3 snapshots to v4', () => {
    LocalStorageRepository.mergeImportedPersonalization({
      userProfiles: [
        {
          id: 'p1',
          name: 'Teen',
          savedAt: new Date().toISOString(),
          model: {
            version: '3.0.0',
            type: 'UserDiagram',
            size: { width: 10, height: 10 },
            elements: {},
            relationships: {},
            interactive: { elements: {}, relationships: {} },
            assessments: {},
          } as any,
        },
      ],
      agentConfigurations: [
        {
          id: 'c1',
          name: 'Config',
          savedAt: new Date().toISOString(),
          config: {} as any,
          baseAgentModel: agentModelV3({ r1: flatTransition('r1', 'when_intent_matched', 'Hi') }) as any,
          originalAgentModel: null,
          personalizedAgentModel: null,
        },
      ],
      agentBaseModels: {
        'diagram-1': agentModelV3({ r1: flatTransition('r1', 'auto', '') }) as any,
      },
      activeAgentConfigurationId: 'c1',
    });

    const [profile] = LocalStorageRepository.getUserProfiles();
    expect((profile.model as AnyModel).version).toBe('4.0.0');

    const [config] = LocalStorageRepository.getAgentConfigurations();
    expect((config.baseAgentModel as AnyModel).version).toBe('4.0.0');

    const base = LocalStorageRepository.getAgentBaseModel('diagram-1') as AnyModel;
    expect(base.version).toBe('4.0.0');

    expect(LocalStorageRepository.getActiveAgentConfigurationId()).toBe('c1');
  });

  it('existing entries win on id collision', () => {
    const existingProfile = LocalStorageRepository.saveUserProfile('Mine', {
      version: '4.0.0',
      id: 'm',
      title: 'Mine',
      type: 'UserDiagram',
      nodes: [],
      edges: [],
      assessments: {},
    } as any);

    LocalStorageRepository.mergeImportedPersonalization({
      userProfiles: [
        {
          id: existingProfile.id,
          name: 'Imported Name',
          savedAt: new Date().toISOString(),
          model: { version: '4.0.0', id: 'x', title: '', type: 'UserDiagram', nodes: [], edges: [], assessments: {} } as any,
        },
      ],
    });

    const profiles = LocalStorageRepository.getUserProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Mine');
  });

  it('agentBaseModels: existing diagram keys win, missing keys are added', () => {
    LocalStorageRepository.saveAgentBaseModel('diagram-1', {
      version: '4.0.0',
      id: 'keep',
      title: 'Keep',
      type: 'AgentDiagram',
      nodes: [],
      edges: [],
      assessments: {},
    } as any);

    LocalStorageRepository.mergeImportedPersonalization({
      agentBaseModels: {
        'diagram-1': agentModelV3({ r1: flatTransition('r1', 'auto', '') }) as any,
        'diagram-2': agentModelV3({ r2: flatTransition('r2', 'auto', '') }) as any,
      },
    });

    expect((LocalStorageRepository.getAgentBaseModel('diagram-1') as AnyModel).id).toBe('keep');
    expect((LocalStorageRepository.getAgentBaseModel('diagram-2') as AnyModel).version).toBe('4.0.0');
  });

  it('does not steal the active configuration id from an in-progress session', () => {
    LocalStorageRepository.setActiveAgentConfigurationId('mine');

    LocalStorageRepository.mergeImportedPersonalization({
      agentConfigurations: [
        {
          id: 'imported',
          name: 'Imported',
          savedAt: new Date().toISOString(),
          config: {} as any,
          baseAgentModel: null,
          originalAgentModel: null,
          personalizedAgentModel: null,
        },
      ],
      activeAgentConfigurationId: 'imported',
    });

    expect(LocalStorageRepository.getActiveAgentConfigurationId()).toBe('mine');
  });

  it('ignores an active id that does not resolve to a stored configuration', () => {
    LocalStorageRepository.mergeImportedPersonalization({
      activeAgentConfigurationId: 'ghost',
    });
    expect(LocalStorageRepository.getActiveAgentConfigurationId()).toBeNull();
  });
});
