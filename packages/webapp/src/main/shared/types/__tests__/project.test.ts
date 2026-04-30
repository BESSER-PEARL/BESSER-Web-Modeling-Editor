import { describe, expect, it } from 'vitest';
import { UMLDiagramType, type UMLModel } from '@besser/wme';
import {
  ALL_DIAGRAM_TYPES,
  PROJECT_SCHEMA_VERSION,
  type BesserProject,
  type ProjectDiagram,
  type SupportedDiagramType,
  createDefaultPerspectives,
  createDefaultProject,
  createEmptyDiagram,
  defaultPerspectivesAllEnabled,
  ensureProjectMigrated,
  findHiddenReferencedPerspectives,
  isPerspectiveVisible,
  isProject,
} from '../project';
import { PERSPECTIVES, isPresetActive, perspectivesFromDiagramList } from '../../perspectives';

const populatedClassModel = (): UMLModel => ({
  version: '3.0.0',
  type: UMLDiagramType.ClassDiagram,
  size: { width: 1400, height: 740 },
  elements: {
    'class-1': { id: 'class-1', name: 'Foo', type: 'Class', owner: null, bounds: { x: 0, y: 0, width: 0, height: 0 } } as any,
  },
  relationships: {},
  interactive: { elements: {}, relationships: {} },
  assessments: {},
});

describe('createDefaultPerspectives', () => {
  it('returns true for every supported diagram type', () => {
    const map = createDefaultPerspectives();
    for (const type of ALL_DIAGRAM_TYPES) {
      expect(map[type]).toBe(true);
    }
  });
});

describe('defaultPerspectivesAllEnabled', () => {
  it('returns all-true when given undefined', () => {
    const map = defaultPerspectivesAllEnabled(undefined);
    for (const type of ALL_DIAGRAM_TYPES) {
      expect(map[type]).toBe(true);
    }
  });

  it('preserves explicit user choices and fills missing keys with true', () => {
    const partial: Partial<Record<SupportedDiagramType, boolean>> = {
      ClassDiagram: false,
      GUINoCodeDiagram: false,
    };
    const map = defaultPerspectivesAllEnabled(partial);
    expect(map.ClassDiagram).toBe(false);
    expect(map.GUINoCodeDiagram).toBe(false);
    expect(map.ObjectDiagram).toBe(true);
    expect(map.AgentDiagram).toBe(true);
    expect(map.UserDiagram).toBe(true);
    expect(map.StateMachineDiagram).toBe(true);
    expect(map.QuantumCircuitDiagram).toBe(true);
  });
});

describe('isPerspectiveVisible', () => {
  it('treats undefined map as fully visible', () => {
    expect(isPerspectiveVisible(undefined, 'ClassDiagram')).toBe(true);
  });

  it('treats missing key as visible (default-on safety net)', () => {
    expect(isPerspectiveVisible({} as any, 'ObjectDiagram')).toBe(true);
  });

  it('returns false only when explicitly false', () => {
    expect(isPerspectiveVisible({ ClassDiagram: false } as any, 'ClassDiagram')).toBe(false);
    expect(isPerspectiveVisible({ ClassDiagram: true } as any, 'ClassDiagram')).toBe(true);
  });
});

describe('createDefaultProject', () => {
  it('initializes settings.perspectives with all types enabled', () => {
    const project = createDefaultProject('Demo', 'desc', 'me');
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    for (const type of ALL_DIAGRAM_TYPES) {
      expect(project.settings.perspectives[type]).toBe(true);
    }
  });
});

describe('ensureProjectMigrated v3 → v4', () => {
  it('adds perspectives with all-true defaults to a v3 project that lacks them', () => {
    const v3Project = {
      ...createDefaultProject('Legacy', 'desc', 'me'),
      schemaVersion: 3,
      settings: {
        defaultDiagramType: 'ClassDiagram',
        autoSave: true,
        collaborationEnabled: false,
      } as any,
    } as BesserProject;

    expect(isProject(v3Project)).toBe(true);

    const migrated = ensureProjectMigrated(v3Project);
    expect(migrated.schemaVersion).toBe(4);
    for (const type of ALL_DIAGRAM_TYPES) {
      expect(migrated.settings.perspectives[type]).toBe(true);
    }
  });

  it('preserves existing user-set perspectives on a v3 project that already has some', () => {
    const v3Project = {
      ...createDefaultProject('Legacy', 'desc', 'me'),
      schemaVersion: 3,
      settings: {
        defaultDiagramType: 'ClassDiagram',
        autoSave: true,
        collaborationEnabled: false,
        perspectives: { ClassDiagram: false, ObjectDiagram: true } as any,
      } as any,
    } as BesserProject;

    const migrated = ensureProjectMigrated(v3Project);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.settings.perspectives.ClassDiagram).toBe(false);
    expect(migrated.settings.perspectives.ObjectDiagram).toBe(true);
    expect(migrated.settings.perspectives.AgentDiagram).toBe(true);
    expect(migrated.settings.perspectives.QuantumCircuitDiagram).toBe(true);
  });

  it('is idempotent on an already-migrated v4 project', () => {
    const project = createDefaultProject('Fresh', '', 'me');
    project.settings.perspectives.AgentDiagram = false;
    const migrated = ensureProjectMigrated(project);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.settings.perspectives.AgentDiagram).toBe(false);
    expect(migrated.settings.perspectives.ClassDiagram).toBe(true);
  });
});

describe('findHiddenReferencedPerspectives', () => {
  function withDiagrams(
    project: BesserProject,
    type: SupportedDiagramType,
    diagrams: ProjectDiagram[],
  ): BesserProject {
    return { ...project, diagrams: { ...project.diagrams, [type]: diagrams } };
  }

  it('returns [] when all perspectives visible', () => {
    const project = createDefaultProject('Clean', '', 'me');
    expect(findHiddenReferencedPerspectives(project)).toEqual([]);
  });

  it('returns hidden type when it has its own non-empty content', () => {
    let project = createDefaultProject('HasContent', '', 'me');
    project.settings.perspectives.ObjectDiagram = false;
    const objectDiagram = createEmptyDiagram('Obj', UMLDiagramType.ObjectDiagram);
    objectDiagram.model = {
      ...(objectDiagram.model as UMLModel),
      elements: { 'obj-1': { id: 'obj-1' } as any },
    } as any;
    project = withDiagrams(project, 'ObjectDiagram', [objectDiagram]);

    expect(findHiddenReferencedPerspectives(project)).toEqual(['ObjectDiagram']);
  });

  it('returns hidden type referenced by another diagram with content', () => {
    let project = createDefaultProject('Refs', '', 'me');
    project.settings.perspectives.ClassDiagram = false;

    const classDiag = project.diagrams.ClassDiagram[0];
    classDiag.model = populatedClassModel();
    project = withDiagrams(project, 'ClassDiagram', [classDiag]);

    const guiDiag = project.diagrams.GUINoCodeDiagram[0];
    guiDiag.references = { ClassDiagram: classDiag.id };
    project = withDiagrams(project, 'GUINoCodeDiagram', [guiDiag]);

    expect(findHiddenReferencedPerspectives(project)).toEqual(['ClassDiagram']);
  });

  it('does not flag a hidden type whose diagrams are all empty and unreferenced', () => {
    const project = createDefaultProject('Empty', '', 'me');
    project.settings.perspectives.AgentDiagram = false;
    expect(findHiddenReferencedPerspectives(project)).toEqual([]);
  });

  it('does not flag a hidden type when the reference points at a missing target', () => {
    const project = createDefaultProject('BrokenRef', '', 'me');
    project.settings.perspectives.ClassDiagram = false;
    const guiDiag = project.diagrams.GUINoCodeDiagram[0];
    guiDiag.references = { ClassDiagram: 'nonexistent-id' };
    expect(findHiddenReferencedPerspectives(project)).toEqual([]);
  });

  it('returns multiple hidden types in canonical order', () => {
    let project = createDefaultProject('Multi', '', 'me');
    project.settings.perspectives.ObjectDiagram = false;
    project.settings.perspectives.AgentDiagram = false;

    const obj = createEmptyDiagram('Obj', UMLDiagramType.ObjectDiagram);
    obj.model = {
      ...(obj.model as UMLModel),
      elements: { 'obj-1': { id: 'obj-1' } as any },
    } as any;
    project = withDiagrams(project, 'ObjectDiagram', [obj]);

    const agent = createEmptyDiagram('Agent', UMLDiagramType.AgentDiagram);
    agent.model = {
      ...(agent.model as UMLModel),
      elements: { 'a-1': { id: 'a-1' } as any },
    } as any;
    project = withDiagrams(project, 'AgentDiagram', [agent]);

    expect(findHiddenReferencedPerspectives(project)).toEqual(['ObjectDiagram', 'AgentDiagram']);
  });
});

describe('preset helpers', () => {
  it('isPresetActive matches "Show All" when every perspective is enabled', () => {
    const all = createDefaultPerspectives();
    const showAll = PERSPECTIVES.find((p) => p.key === 'all')!;
    expect(isPresetActive(showAll, all)).toBe(true);
  });

  it('isPresetActive matches the Data preset when only Class+Object are enabled', () => {
    const map = perspectivesFromDiagramList(['ClassDiagram', 'ObjectDiagram']);
    const data = PERSPECTIVES.find((p) => p.key === 'data')!;
    expect(isPresetActive(data, map)).toBe(true);
    const fullApp = PERSPECTIVES.find((p) => p.key === 'fullApp')!;
    expect(isPresetActive(fullApp, map)).toBe(false);
  });

  it('perspectivesFromDiagramList enables exactly the listed types', () => {
    const map = perspectivesFromDiagramList(['QuantumCircuitDiagram']);
    expect(map.QuantumCircuitDiagram).toBe(true);
    expect(map.ClassDiagram).toBe(false);
    expect(map.AgentDiagram).toBe(false);
  });
});
