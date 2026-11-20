import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LabDone, LabThreadItem } from '../../../shared/api/lab';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { createLabProject, deleteLabProject, labProjectId, latestThreadModel, loadLabProject } from '../labProject';

const classModel = (type = 'ClassDiagram') => ({
  version: '3.0.0',
  type,
  size: { width: 0, height: 0 },
  interactive: { elements: {}, relationships: {} },
  elements: {},
  relationships: {},
  assessments: {},
});

const planRun = (at: number, model: unknown, step: 'plan' | 'build' = 'plan'): LabThreadItem => ({
  type: 'run',
  runId: `r${at}`,
  at,
  login: 'jordi',
  status: 'done',
  lab: { step, changeId: 'c1', modelProposal: { title: `Proposal ${at}`, diagramType: 'ClassDiagram', model } } as unknown as LabDone,
  error: null,
  costUsd: null,
  planVersion: step === 'plan' ? 1 : null,
});

const message = (at: number, model: Record<string, unknown> | null): LabThreadItem => ({
  type: 'message',
  id: `m${at}`,
  at,
  login: 'ana',
  text: 'Build it',
  action: 'auto',
  model,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('the change project', () => {
  it('is lab-<changeId>, named after the change, with its class diagram open', () => {
    const project = createLabProject('c1', 'Note element', 'jordi');
    expect(project.id).toBe('lab-c1');
    expect(labProjectId('c1')).toBe('lab-c1');
    expect(project).toMatchObject({ name: 'Note element', owner: 'jordi', currentDiagramType: 'ClassDiagram' });
    expect(loadLabProject('c1')?.id).toBe('lab-c1');
  });

  it('is named "New change" while the change is a draft without a title', () => {
    expect(createLabProject('c2', '', 'ana').name).toBe('New change');
  });

  it('is null, without a warning, in a browser that has none', () => {
    const warn = vi.spyOn(console, 'warn');
    expect(loadLabProject('c9')).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('is removed with its change', () => {
    createLabProject('c1', 'Note element', 'jordi');
    deleteLabProject('c1');
    expect(loadLabProject('c1')).toBeNull();
    expect(ProjectStorageRepository.getAllProjects()).toEqual([]);
  });
});

describe('latestThreadModel', () => {
  it("is the last plan's proposal when it came after the last message with a model", () => {
    const found = latestThreadModel([message(1, classModel()), planRun(2, classModel()), planRun(3, classModel())]);
    expect(found).toMatchObject({ source: 'proposal', at: 3, proposal: { title: 'Proposal 3' } });
  });

  it("is the last message's model when it came after the last plan's proposal", () => {
    const found = latestThreadModel([planRun(1, classModel()), message(2, classModel()), message(3, null)]);
    expect(found).toMatchObject({ source: 'message', at: 2 });
  });

  it('ignores build runs and models that are not class diagrams, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(latestThreadModel([planRun(1, classModel(), 'build'), planRun(2, classModel('StateMachineDiagram'))])).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('is null for a thread without a model', () => {
    expect(latestThreadModel([message(1, null)])).toBeNull();
  });
});
