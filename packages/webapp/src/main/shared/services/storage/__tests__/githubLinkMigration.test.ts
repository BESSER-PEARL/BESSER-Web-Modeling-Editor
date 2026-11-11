/**
 * A GitHub-linked project stored by the v3 editor keeps its sync state when
 * loading lifts its models to v4: `syncedModel` was a fingerprint of the v3
 * models and was never restamped, so every linked project read as changed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectStorageRepository } from '../ProjectStorageRepository';
import {
  GITHUB_LINK_CHANGED_EVENT,
  getProjectGitHubLink,
  hasUnsyncedModelChanges,
  modelFingerprint,
  setProjectGitHubLink,
} from '../projectGitHubLink';
import { createDefaultProject, isUMLModel, type BesserProject } from '../../../types/project';

const v3ClassModel = (className: string) => ({
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 400, height: 300 },
  interactive: { elements: {}, relationships: {} },
  elements: {
    c1: {
      id: 'c1', name: className, type: 'Class', owner: null,
      bounds: { x: 0, y: 0, width: 160, height: 80 }, attributes: ['a1'], methods: [],
    },
    a1: {
      id: 'a1', name: '+ title: str', type: 'ClassAttribute', owner: 'c1',
      bounds: { x: 0, y: 40, width: 160, height: 30 },
    },
  },
  relationships: {},
  assessments: {},
});

/** A project as the v3 editor left it in storage. */
const storedV3Project = (className: string): BesserProject => {
  const project = createDefaultProject('Library', '', '');
  project.schemaVersion = 4;
  project.diagrams.ClassDiagram[0].model = v3ClassModel(className) as never;
  return JSON.parse(JSON.stringify(project));
};

const store = (project: BesserProject) =>
  localStorage.setItem(`besser_project_${project.id}`, JSON.stringify(project));

const link = (project: BesserProject, syncedWith: BesserProject) =>
  setProjectGitHubLink(project.id, {
    owner: 'me',
    repo: 'library',
    branch: 'main',
    baseCommitSha: 'a'.repeat(40),
    syncedModel: modelFingerprint(syncedWith),
  });

describe('GitHub link across the v3 to v4 migration', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('a linked project that was in sync stays in sync after load', () => {
    const stored = storedV3Project('Book');
    store(stored);
    link(stored, stored);

    const loaded = ProjectStorageRepository.loadProject(stored.id)!;
    expect(isUMLModel(loaded.diagrams.ClassDiagram[0].model)).toBe(true);
    expect(hasUnsyncedModelChanges(loaded, getProjectGitHubLink(stored.id)!)).toBe(false);

    // The project is still stored as v3 until its next save: later loads agree.
    const again = ProjectStorageRepository.loadProject(stored.id)!;
    expect(hasUnsyncedModelChanges(again, getProjectGitHubLink(stored.id)!)).toBe(false);
  });

  it('a linked project with local changes stays changed', () => {
    const stored = storedV3Project('Novel');
    store(stored);
    // Last synced when the class was still called Book.
    link(stored, { ...storedV3Project('Book'), id: stored.id });
    const before = getProjectGitHubLink(stored.id)!.syncedModel;

    const loaded = ProjectStorageRepository.loadProject(stored.id)!;
    expect(getProjectGitHubLink(stored.id)!.syncedModel).toBe(before);
    expect(hasUnsyncedModelChanges(loaded, getProjectGitHubLink(stored.id)!)).toBe(true);
  });

  it('tells listeners after the load, not during it', async () => {
    const stored = storedV3Project('Book');
    store(stored);
    link(stored, stored);
    const heard = vi.fn();
    window.addEventListener(GITHUB_LINK_CHANGED_EVENT, heard);

    ProjectStorageRepository.loadProject(stored.id);
    expect(heard).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(GITHUB_LINK_CHANGED_EVENT, heard);
  });
});
