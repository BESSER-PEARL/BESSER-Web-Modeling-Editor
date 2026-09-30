import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-toastify (imported transitively by localStorageQuota).
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { runStorageMigrations } from '../storage-migration';
import { localStorageAgentBaseModels, localStorageUserProfiles } from '../../constants/constant';

const STORAGE_VERSION_KEY = 'besser_storage_version';

/** Develop-era v3 AgentDiagram snapshot with a flat (pre-nesting) transition. */
const v3AgentModel = () => ({
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
      source: { element: 's', direction: 'Right' },
      target: { element: 't', direction: 'Left' },
      path: [{ x: 0, y: 0 }],
      condition: 'when_intent_matched',
      conditionValue: 'Greeting',
    },
  },
  assessments: {},
});

const v3UserModel = () => ({
  version: '3.0.0',
  type: 'UserDiagram',
  size: { width: 10, height: 10 },
  elements: {},
  relationships: {},
  interactive: { elements: {}, relationships: {} },
  assessments: {},
});

const rawStored = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null');

describe('runStorageMigrations', () => {
  let info: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    localStorage.clear();
    info = vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    info.mockRestore();
  });

  const seedV3Snapshots = () => {
    localStorage.setItem(localStorageAgentBaseModels, JSON.stringify({ d1: v3AgentModel() }));
    localStorage.setItem(
      localStorageUserProfiles,
      JSON.stringify([{ id: 'p1', name: 'Teen', savedAt: new Date().toISOString(), model: v3UserModel() }]),
    );
  };

  it('lifts side stores for users coming from production (which already recorded version 4)', () => {
    // The old-editor app wrote `besser_storage_version = 4` for its own
    // (different) step 4, so the React Flow lift must run as a later step.
    localStorage.setItem(STORAGE_VERSION_KEY, '4');
    seedV3Snapshots();

    runStorageMigrations();

    expect(localStorage.getItem(STORAGE_VERSION_KEY)).toBe('5');
    const base = rawStored(localStorageAgentBaseModels).d1;
    expect(base.version).toBe('4.0.0');
    expect(Array.isArray(base.nodes)).toBe(true);
    expect(base.elements).toBeUndefined();
    const [profile] = rawStored(localStorageUserProfiles);
    expect(profile.model.version).toBe('4.0.0');
  });

  it('is idempotent for installs that already ran this build’s step 4', () => {
    localStorage.setItem(STORAGE_VERSION_KEY, '4');
    seedV3Snapshots();
    runStorageMigrations();
    const first = localStorage.getItem(localStorageAgentBaseModels);

    // Re-running (e.g. a user bounced between builds) changes nothing.
    localStorage.setItem(STORAGE_VERSION_KEY, '4');
    runStorageMigrations();
    expect(localStorage.getItem(localStorageAgentBaseModels)).toBe(first);
  });

  it('runs every step on a fresh install and records the current version', () => {
    seedV3Snapshots();
    runStorageMigrations();
    expect(localStorage.getItem(STORAGE_VERSION_KEY)).toBe('5');
    expect(rawStored(localStorageAgentBaseModels).d1.version).toBe('4.0.0');
  });

  it('never downgrades a version recorded by a newer build', () => {
    localStorage.setItem(STORAGE_VERSION_KEY, '9');
    runStorageMigrations();
    expect(localStorage.getItem(STORAGE_VERSION_KEY)).toBe('9');
  });
});
