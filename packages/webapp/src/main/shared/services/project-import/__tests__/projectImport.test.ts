import { importProjectFromJson } from '../projectImport';
import { LocalStorageRepository } from '../../storage/local-storage-repository';
import { createDefaultProject, isUMLModel } from '../../../types/project';
import {
  localStorageActiveAgentConfiguration,
  localStorageAgentBaseModels,
  localStorageAgentConfigurations,
  localStorageUserProfiles,
} from '../../../constants/constant';

// Mock react-toastify (imported transitively by ProjectStorageRepository's quota check).
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

type AnyModel = Record<string, any>;

/** Develop-era v3 AgentDiagram model with one flat transition. */
const v3AgentModel = (): AnyModel => ({
  version: '3.0.0',
  type: 'AgentDiagram',
  size: { width: 100, height: 100 },
  elements: {},
  interactive: { elements: {}, relationships: {} },
  relationships: {
    r1: {
      id: 'r1',
      name: '',
      type: 'AgentStateTransition',
      owner: null,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      source: { element: 'r1-src', direction: 'Right' },
      target: { element: 'r1-tgt', direction: 'Left' },
      path: [{ x: 0, y: 0 }],
      isManuallyLayouted: false,
      condition: 'when_intent_matched',
      conditionValue: 'Greeting_intent',
    },
  },
  assessments: {},
});

const v3UserModel = (): AnyModel => ({
  version: '3.0.0',
  type: 'UserDiagram',
  size: { width: 10, height: 10 },
  elements: {},
  relationships: {},
  interactive: { elements: {}, relationships: {} },
  assessments: {},
});

const envelopeFile = (envelope: Record<string, unknown>): File =>
  new File([JSON.stringify(envelope)], 'project.json', { type: 'application/json' });

const baseEnvelope = (): Record<string, unknown> => ({
  project: createDefaultProject('Imported', 'desc', 'owner'),
  exportedAt: new Date().toISOString(),
  version: '2.0.0',
});

describe('importProjectFromJson personalization merge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores bundled develop-era (v3) personalization as v4 at rest', async () => {
    const envelope = {
      ...baseEnvelope(),
      agentConfigurations: [
        {
          id: 'config-1',
          name: 'CoolConfig',
          savedAt: new Date().toISOString(),
          config: {},
          baseAgentModel: v3AgentModel(),
          originalAgentModel: v3AgentModel(),
          personalizedAgentModel: v3AgentModel(),
        },
      ],
      userProfiles: [
        { id: 'profile-1', name: 'Teenager', savedAt: new Date().toISOString(), model: v3UserModel() },
      ],
      agentProfileMappings: [
        {
          id: 'mapping-1',
          userProfileId: 'profile-1',
          userProfileName: 'Teenager',
          agentConfigurationId: 'config-1',
          agentConfigurationName: 'CoolConfig',
          savedAt: new Date().toISOString(),
        },
      ],
      activeAgentConfigurationId: 'config-1',
      agentBaseModels: { 'agent-diagram-1': v3AgentModel() },
    };

    await importProjectFromJson(envelopeFile(envelope));

    const [config] = LocalStorageRepository.getAgentConfigurations();
    expect(config.id).toBe('config-1');
    expect(isUMLModel(config.baseAgentModel)).toBe(true);
    expect((config.baseAgentModel as AnyModel).version).toBe('4.0.0');
    expect((config.personalizedAgentModel as AnyModel).version).toBe('4.0.0');

    const [profile] = LocalStorageRepository.getUserProfiles();
    expect(profile.id).toBe('profile-1');
    expect(isUMLModel(profile.model)).toBe(true);

    const mappings = LocalStorageRepository.getAgentProfileConfigurationMappings();
    expect(mappings.map((m) => m.id)).toEqual(['mapping-1']);

    const base = LocalStorageRepository.getAgentBaseModel('agent-diagram-1') as AnyModel;
    expect(isUMLModel(base)).toBe(true);
    const edge = base.edges.find((e: AnyModel) => e.id === 'r1');
    expect(edge.data.transitionType).toBe('predefined');
    expect(edge.data.predefined.intentName).toBe('Greeting_intent');

    expect(LocalStorageRepository.getActiveAgentConfigurationId()).toBe('config-1');
  });

  it('keeps existing entries on id collision and existing active id', async () => {
    // Seed user state before importing.
    localStorage.setItem(
      localStorageUserProfiles,
      JSON.stringify([{ id: 'profile-1', name: 'Mine', savedAt: new Date().toISOString(), model: v3UserModel() }]),
    );
    LocalStorageRepository.setActiveAgentConfigurationId('mine-active');

    const envelope = {
      ...baseEnvelope(),
      userProfiles: [
        { id: 'profile-1', name: 'Imported', savedAt: new Date().toISOString(), model: v3UserModel() },
        { id: 'profile-2', name: 'New', savedAt: new Date().toISOString(), model: v3UserModel() },
      ],
      agentConfigurations: [
        {
          id: 'config-1',
          name: 'Imported',
          savedAt: new Date().toISOString(),
          config: {},
          baseAgentModel: null,
          originalAgentModel: null,
          personalizedAgentModel: null,
        },
      ],
      activeAgentConfigurationId: 'config-1',
    };

    await importProjectFromJson(envelopeFile(envelope));

    const profiles = LocalStorageRepository.getUserProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles.find((p) => p.id === 'profile-1')?.name).toBe('Mine');
    expect(profiles.find((p) => p.id === 'profile-2')?.name).toBe('New');

    // Importing never steals the active configuration pointer.
    expect(LocalStorageRepository.getActiveAgentConfigurationId()).toBe('mine-active');
  });

  it('does not touch personalization keys when the envelope carries none', async () => {
    await importProjectFromJson(envelopeFile(baseEnvelope()));

    expect(localStorage.getItem(localStorageAgentConfigurations)).toBeNull();
    expect(localStorage.getItem(localStorageUserProfiles)).toBeNull();
    expect(localStorage.getItem(localStorageAgentBaseModels)).toBeNull();
    expect(localStorage.getItem(localStorageActiveAgentConfiguration)).toBeNull();
  });

  it('treats a null activeAgentConfigurationId (gym template default) as absent', async () => {
    const envelope = {
      ...baseEnvelope(),
      activeAgentConfigurationId: null,
    };

    await importProjectFromJson(envelopeFile(envelope));

    expect(localStorage.getItem(localStorageActiveAgentConfiguration)).toBeNull();
  });

  it('does not apply an active id that resolves to no stored configuration', async () => {
    const envelope = {
      ...baseEnvelope(),
      activeAgentConfigurationId: 'ghost-config',
    };

    await importProjectFromJson(envelopeFile(envelope));

    expect(LocalStorageRepository.getActiveAgentConfigurationId()).toBeNull();
  });
});
