import { beforeEach, describe, expect, it } from 'vitest';

import { ALL_DIAGRAM_TYPES } from '../../../types/project';
import { ProjectStorageRepository } from '../../storage/ProjectStorageRepository';
import { storeRepoModelAsProject } from '../projectImport';

const agentDiagram = (key: string, language: string) => ({
  id: 'agent-1',
  title: 'Helper',
  model: { elements: {}, relationships: {} },
  lastUpdate: '2026-10-28T00:00:00Z',
  agentConfigForm: { nlp: { openai_api_key: key, language } },
});

const project = (key: string, language: string) => ({
  id: 'p1',
  type: 'Project',
  name: 'Library',
  description: '',
  owner: 'me',
  createdAt: '2026-10-28T00:00:00Z',
  currentDiagramType: 'AgentDiagram',
  currentDiagramIndices: { AgentDiagram: 0 },
  // A stored project lists every diagram type (isProject).
  diagrams: { ...Object.fromEntries(ALL_DIAGRAM_TYPES.map((type) => [type, []])), AgentDiagram: [agentDiagram(key, language)] },
  settings: {},
});

// The model file of a real repo (written by a test script, not the editor): the import
// accepted it, and opening the project then failed with "Project not found".
const invalidProject = {
  id: 'live659',
  type: 'BesserProject',
  name: 'Live659',
  createdAt: '2026-11-02T00:00:00Z',
  diagrams: { ClassDiagram: [{ id: 'c1', title: 'Class Diagram', model: { elements: {}, relationships: {} } }] },
  currentDiagramIndices: { ClassDiagram: 0 },
};

describe('storeRepoModelAsProject', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the agent API key entered here when the repo holds it redacted', () => {
    ProjectStorageRepository.saveProject(project('sk-local-key', 'en') as never);

    const stored = storeRepoModelAsProject(project('[REDACTED]', 'fr'), 'p1');

    const form = (stored.diagrams.AgentDiagram[0] as { agentConfigForm?: { nlp: Record<string, string> } }).agentConfigForm;
    expect(form?.nlp).toEqual({ openai_api_key: 'sk-local-key', language: 'fr' });
  });

  it('keeps the project name when it pulls the repo into the project it replaces', () => {
    ProjectStorageRepository.saveProject(project('sk-local-key', 'en') as never);

    const stored = storeRepoModelAsProject(project('[REDACTED]', 'en'), 'p1');

    expect(stored.name).toBe('Library');
    expect(ProjectStorageRepository.loadProject('p1')?.name).toBe('Library');
  });

  it('returns the project as stored, its models lifted to v4', () => {
    const stored = storeRepoModelAsProject(project('[REDACTED]', 'en'), 'p1');

    const model = stored.diagrams.AgentDiagram[0].model as { version?: string; nodes?: unknown[] };
    expect(model.version).toMatch(/^4\./);
    expect(Array.isArray(model.nodes)).toBe(true);
  });

  it('leaves the local project openable when the repo holds an invalid model', () => {
    ProjectStorageRepository.saveProject(project('sk-local-key', 'en') as never);

    expect(() => storeRepoModelAsProject(invalidProject, 'p1')).toThrow('not a valid BESSER project');

    const local = ProjectStorageRepository.loadProject('p1');
    expect(local?.name).toBe('Library');
  });
});
