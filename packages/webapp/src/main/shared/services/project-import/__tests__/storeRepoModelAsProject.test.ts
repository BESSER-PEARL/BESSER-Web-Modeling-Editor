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
});
