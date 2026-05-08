import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAgentOptions } from '../diagram-helpers';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { BesserProject, createDefaultProject, ProjectDiagram } from '../../../../shared/types/project';

// react-toastify is pulled in transitively via localStorageQuota; stub it.
vi.mock('react-toastify', () => ({
  toast: { warning: vi.fn() },
}));

function makeAgentDiagram(id: string, title: string): ProjectDiagram {
  return {
    id,
    title,
    model: { version: '3.0.0', type: 'AgentDiagram', elements: {}, relationships: {} } as any,
    lastUpdate: new Date().toISOString(),
  };
}

function setCurrentProject(project: BesserProject) {
  // saveProject() also writes localStorageLatestProject so getCurrentProject() resolves.
  ProjectStorageRepository.saveProject(project);
}

describe('getAgentOptions', () => {
  beforeEach(() => {
    localStorage.clear();
    ProjectStorageRepository.revision = 0;
    (ProjectStorageRepository as any).changeListeners = [];
    (ProjectStorageRepository as any).suppressDepth = 0;
  });

  it('returns an empty list when no project is loaded', () => {
    expect(getAgentOptions()).toEqual([]);
  });

  it('returns an empty list when the project has no agent diagrams', () => {
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.AgentDiagram = [];
    setCurrentProject(project);
    expect(getAgentOptions()).toEqual([]);
  });

  it('returns a single entry when the project has one agent diagram', () => {
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.AgentDiagram = [makeAgentDiagram('a1', 'Alpha')];
    setCurrentProject(project);

    expect(getAgentOptions()).toEqual([{ value: 'Alpha', label: 'Alpha' }]);
  });

  it('returns every agent diagram for multi-agent projects', () => {
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.AgentDiagram = [
      makeAgentDiagram('a1', 'Alpha'),
      makeAgentDiagram('a2', 'Beta'),
      makeAgentDiagram('a3', 'Gamma'),
    ];
    setCurrentProject(project);

    expect(getAgentOptions()).toEqual([
      { value: 'Alpha', label: 'Alpha' },
      { value: 'Beta', label: 'Beta' },
      { value: 'Gamma', label: 'Gamma' },
    ]);
  });

  it('filters out agent diagrams missing a title', () => {
    const project = createDefaultProject('Test', '', 'user');
    project.diagrams.AgentDiagram = [
      makeAgentDiagram('a1', 'Alpha'),
      { ...makeAgentDiagram('a2', ''), title: '' },
    ];
    setCurrentProject(project);

    const options = getAgentOptions();
    expect(options).toEqual([{ value: 'Alpha', label: 'Alpha' }]);
  });
});
