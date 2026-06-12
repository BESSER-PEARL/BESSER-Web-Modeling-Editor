import { importProjectFromJson } from '../projectImport';
import { LocalStorageRepository } from '../../storage/local-storage-repository';
import { createDefaultProject, ensureProjectMigrated, isUMLModel } from '../../../types/project';
import {
  localStorageActiveAgentConfiguration,
  localStorageAgentBaseModels,
  localStorageAgentConfigurations,
  localStorageLatestProject,
  localStorageProjectPrefix,
  localStorageUserProfiles,
} from '../../../constants/constant';

// Mock react-toastify (imported transitively by ProjectStorageRepository's
// quota check and directly by projectImport's v3-migration notice). The
// factory is hoisted but the arrow defers the dereference to call time,
// so the const below is initialized first (same pattern as
// features/import/__tests__/useImportDiagram.test.ts).
const toastInfo = vi.fn();
vi.mock('react-toastify', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    info: (...args: any[]) => toastInfo(...args),
  },
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

/** Minimal develop-era v3 ClassDiagram model with one class. */
const v3ClassModel = (): AnyModel => ({
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 100, height: 100 },
  interactive: { elements: {}, relationships: {} },
  elements: {
    'el-1': {
      id: 'el-1',
      type: 'Class',
      name: 'Foo',
      owner: null,
      bounds: { x: 0, y: 0, width: 200, height: 100 },
      attributes: [],
      methods: [],
    },
  },
  relationships: {},
  assessments: {},
});

/** Canonical v4 ClassDiagram model. */
const v4ClassModel = (): AnyModel => ({
  version: '4.0.0',
  id: 'm-1',
  title: 'Modern Class',
  type: 'ClassDiagram',
  nodes: [],
  edges: [],
});

/** Old-webapp export: per-type single diagram objects, not arrays. */
const oldWebappEnvelope = (model: AnyModel): Record<string, unknown> => ({
  project: {
    name: 'Legacy Project',
    description: 'old webapp export',
    owner: 'owner',
    diagrams: {
      ClassDiagram: {
        title: 'Legacy Class',
        model,
        lastUpdate: '2024-01-01T00:00:00.000Z',
      },
    },
  },
});

describe('importProjectFromJson legacy format migration', () => {
  beforeEach(() => {
    localStorage.clear();
    toastInfo.mockClear();
  });

  it('migrates v3 models in old-webapp exports to v4 before stamping schemaVersion 5', async () => {
    const project = await importProjectFromJson(envelopeFile(oldWebappEnvelope(v3ClassModel())));

    expect(project.schemaVersion).toBe(5);
    expect(Array.isArray(project.diagrams.ClassDiagram)).toBe(true);
    expect(project.diagrams.ClassDiagram).toHaveLength(1);

    const model = project.diagrams.ClassDiagram[0].model as AnyModel;
    expect(isUMLModel(model)).toBe(true);
    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].data.name).toBe('Foo');

    // Missing types are filled as empty arrays, not objects.
    expect(Array.isArray(project.diagrams.ObjectDiagram)).toBe(true);
    expect(Array.isArray(project.diagrams.AgentDiagram)).toBe(true);

    // The user is told their file was lifted from the v3 schema.
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(String(toastInfo.mock.calls[0]?.[0])).toMatch(/v3 schema/i);
  });

  it('migrates raw bare v3 diagram imports to v4', async () => {
    const bare = {
      id: 'bare-1',
      title: 'Bare v3 Diagram',
      model: v3ClassModel(),
    };

    const project = await importProjectFromJson(envelopeFile(bare));

    expect(project.schemaVersion).toBe(5);
    expect(Array.isArray(project.diagrams.ClassDiagram)).toBe(true);
    const model = project.diagrams.ClassDiagram[0].model as AnyModel;
    expect(isUMLModel(model)).toBe(true);
    expect(model.nodes).toHaveLength(1);
    expect(toastInfo).toHaveBeenCalledTimes(1);
  });

  it('passes raw bare v4 diagram imports through untouched', async () => {
    const bare = {
      id: 'bare-2',
      title: 'Bare v4 Diagram',
      model: v4ClassModel(),
    };

    const project = await importProjectFromJson(envelopeFile(bare));

    expect(project.schemaVersion).toBe(5);
    expect(project.diagrams.ClassDiagram[0].model).toEqual(v4ClassModel());
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('rejects and stores nothing when a v3 model fails migration', async () => {
    // v3 detector fires (elements + relationships) but the model in the
    // ClassDiagram bucket claims to be an ObjectDiagram — the per-type
    // migrator throws on the mismatch.
    const corrupt = { ...v3ClassModel(), type: 'ObjectDiagram' };

    await expect(
      importProjectFromJson(envelopeFile(oldWebappEnvelope(corrupt))),
    ).rejects.toThrow(/Failed to import project/);

    // Nothing was persisted: no latest-project pointer, no project entry.
    expect(localStorage.getItem(localStorageLatestProject)).toBeNull();
  });

  it('preserves the file schemaVersion on V2 envelopes so load-time migration handles v3 models', async () => {
    const project = createDefaultProject('V2 Era', 'desc', 'owner');
    (project as AnyModel).schemaVersion = 2;
    project.diagrams.ClassDiagram = [
      {
        id: 'cd-1',
        title: 'Legacy Class',
        model: v3ClassModel() as any,
        lastUpdate: '2024-01-01T00:00:00.000Z',
      },
    ];

    const envelope = { project, exportedAt: new Date().toISOString(), version: '2.0.0' };
    const imported = await importProjectFromJson(envelopeFile(envelope));

    // Regression guard: the import must NOT stamp schemaVersion 5 here —
    // the file's own version is preserved so `ensureProjectMigrated`
    // migrates on load.
    const raw = JSON.parse(localStorage.getItem(`${localStorageProjectPrefix}${imported.id}`)!);
    expect(raw.schemaVersion).toBe(2);

    const migrated = ensureProjectMigrated(imported);
    expect(migrated.schemaVersion).toBe(5);
    expect(isUMLModel(migrated.diagrams.ClassDiagram[0].model)).toBe(true);
  });
});
