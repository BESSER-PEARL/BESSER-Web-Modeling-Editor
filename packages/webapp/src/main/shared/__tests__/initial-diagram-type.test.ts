import { describe, expect, it, vi } from 'vitest';
import { NON_UML_EDITOR_ITEMS, UML_ITEMS } from '../../app/shell/workspace-navigation';
import { PERSPECTIVES, perspectivesFromDiagramList } from '../perspectives';
import { ProjectStorageRepository } from '../services/storage/ProjectStorageRepository';
import {
  SIDEBAR_DIAGRAM_ORDER,
  createDefaultProject,
  isPerspectiveVisible,
  resolveInitialDiagramType,
  toSupportedDiagramType,
} from '../types/project';

// localStorageQuota (imported by the repository) pulls in react-toastify.
vi.mock('react-toastify', () => ({ toast: { warning: vi.fn() } }));

const preset = (key: string) => PERSPECTIVES.find((p) => p.key === key)!;
const createWithPreset = (key: string) =>
  createDefaultProject(
    'P',
    '',
    'me',
    perspectivesFromDiagramList(preset(key).diagrams),
    undefined,
    preset(key).entryDiagram,
  );

describe('SIDEBAR_DIAGRAM_ORDER', () => {
  it('matches the order of the workspace sidebar', () => {
    expect(SIDEBAR_DIAGRAM_ORDER).toEqual([
      ...UML_ITEMS.map((item) => toSupportedDiagramType(item.type)),
      ...NON_UML_EDITOR_ITEMS.map((item) => item.type),
    ]);
  });
});

describe('initial diagram type of a new project', () => {
  it.each(PERSPECTIVES.map((p) => [p.key]))('opens a %s project on a diagram shown in the sidebar', (key) => {
    const project = createWithPreset(key);
    expect(isPerspectiveVisible(project.settings.perspectives, project.currentDiagramType)).toBe(true);
    expect(project.currentDiagramType).toBe(
      preset(key).entryDiagram ?? SIDEBAR_DIAGRAM_ORDER.find((t) => preset(key).diagrams.includes(t)),
    );
  });

  it('opens a Multi-Agent project on its BPMN diagram', () => {
    expect(createWithPreset('agenticSwarm').currentDiagramType).toBe('BPMN');
  });

  it('keeps opening on the Class diagram when the preset shows it', () => {
    for (const key of ['data', 'fullApp', 'all']) expect(createWithPreset(key).currentDiagramType).toBe('ClassDiagram');
    expect(createDefaultProject('P', '', 'me').currentDiagramType).toBe('ClassDiagram');
  });

  it('falls back to the first visible type in sidebar order', () => {
    expect(createWithPreset('agent').currentDiagramType).toBe('AgentDiagram');
    expect(createWithPreset('quantum').currentDiagramType).toBe('QuantumCircuitDiagram');
    // A hidden preferred type is ignored.
    expect(resolveInitialDiagramType(perspectivesFromDiagramList(['UserDiagram', 'NNDiagram']), 'BPMN')).toBe(
      'UserDiagram',
    );
  });

  it('is stored with the project the repository creates', () => {
    const { diagrams, entryDiagram } = preset('agenticSwarm');
    const project = ProjectStorageRepository.createNewProject(
      'Swarm',
      '',
      'me',
      perspectivesFromDiagramList(diagrams),
      undefined,
      entryDiagram,
    );
    expect(ProjectStorageRepository.loadProject(project.id)?.currentDiagramType).toBe('BPMN');
  });
});
