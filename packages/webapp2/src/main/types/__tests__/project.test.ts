import { UMLDiagramType } from '@besser/wme';
import {
  isProject,
  ensureProjectMigrated,
  createDefaultProject,
  createEmptyDiagram,
  toSupportedDiagramType,
  toUMLDiagramType,
  getActiveDiagram,
  getReferencedDiagram,
  isUMLModel,
  isGrapesJSProjectData,
  isQuantumCircuitData,
  normalizeToGrapesJSProjectData,
  ALL_DIAGRAM_TYPES,
  PROJECT_SCHEMA_VERSION,
  BesserProject,
} from '../project';

// ────────────────────────────────────────────────────────────────────────────
// isProject
// ────────────────────────────────────────────────────────────────────────────

describe('isProject', () => {
  it('returns false for null / undefined / primitives', () => {
    expect(isProject(null)).toBe(false);
    expect(isProject(undefined)).toBe(false);
    expect(isProject(42)).toBe(false);
    expect(isProject('string')).toBe(false);
  });

  it('returns false when type is not "Project"', () => {
    expect(isProject({ type: 'Diagram' })).toBe(false);
  });

  it('returns false when diagrams or currentDiagramType is missing', () => {
    expect(isProject({ type: 'Project', diagrams: {} })).toBe(false);
    expect(isProject({ type: 'Project', currentDiagramType: 'ClassDiagram' })).toBe(false);
  });

  it('returns false when a required diagram type is missing', () => {
    expect(
      isProject({
        type: 'Project',
        currentDiagramType: 'ClassDiagram',
        diagrams: {
          ClassDiagram: [],
          ObjectDiagram: [],
          StateMachineDiagram: [],
          AgentDiagram: [],
          // GUINoCodeDiagram missing
        },
      }),
    ).toBe(false);
  });

  it('returns true for a valid project object', () => {
    const project = createDefaultProject('Test', 'desc', 'owner');
    expect(isProject(project)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// createDefaultProject
// ────────────────────────────────────────────────────────────────────────────

describe('createDefaultProject', () => {
  it('creates a project with correct metadata', () => {
    const project = createDefaultProject('My Project', 'A description', 'alice');

    expect(project.name).toBe('My Project');
    expect(project.description).toBe('A description');
    expect(project.owner).toBe('alice');
    expect(project.type).toBe('Project');
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(project.id).toBeTruthy();
    expect(project.createdAt).toBeTruthy();
  });

  it('initializes all diagram types with one diagram each', () => {
    const project = createDefaultProject('P', '', '');

    for (const type of ALL_DIAGRAM_TYPES) {
      expect(project.diagrams[type]).toHaveLength(1);
      expect(project.diagrams[type][0].id).toBeTruthy();
      expect(project.diagrams[type][0].title).toBeTruthy();
    }
  });

  it('sets default settings', () => {
    const project = createDefaultProject('P', '', '');

    expect(project.settings.defaultDiagramType).toBe('ClassDiagram');
    expect(project.settings.autoSave).toBe(true);
    expect(project.settings.collaborationEnabled).toBe(false);
  });

  it('sets all currentDiagramIndices to 0', () => {
    const project = createDefaultProject('P', '', '');

    for (const type of ALL_DIAGRAM_TYPES) {
      expect(project.currentDiagramIndices[type]).toBe(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// createEmptyDiagram
// ────────────────────────────────────────────────────────────────────────────

describe('createEmptyDiagram', () => {
  it('creates a UML diagram with the correct structure', () => {
    const diagram = createEmptyDiagram('Class Diagram', UMLDiagramType.ClassDiagram);

    expect(diagram.id).toBeTruthy();
    expect(diagram.title).toBe('Class Diagram');
    expect(diagram.lastUpdate).toBeTruthy();

    const model = diagram.model as any;
    expect(model.version).toBe('3.0.0');
    expect(model.type).toBe('ClassDiagram');
    expect(model.elements).toEqual({});
    expect(model.relationships).toEqual({});
  });

  it('creates a GUI diagram when diagramKind is "gui"', () => {
    const diagram = createEmptyDiagram('GUI Diagram', null, 'gui');

    const model = diagram.model as any;
    expect(Array.isArray(model.pages)).toBe(true);
    expect(model.pages).toHaveLength(1);
    expect(model.pages[0].name).toBe('Home');
  });

  it('creates a quantum diagram when diagramKind is "quantum"', () => {
    const diagram = createEmptyDiagram('Quantum Circuit', null, 'quantum');

    const model = diagram.model as any;
    expect(Array.isArray(model.cols)).toBe(true);
    expect(Array.isArray(model.gates)).toBe(true);
    expect(model.version).toBe('1.0.0');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// toSupportedDiagramType / toUMLDiagramType
// ────────────────────────────────────────────────────────────────────────────

describe('toSupportedDiagramType', () => {
  it('maps known UMLDiagramTypes correctly', () => {
    expect(toSupportedDiagramType(UMLDiagramType.ClassDiagram)).toBe('ClassDiagram');
    expect(toSupportedDiagramType(UMLDiagramType.ObjectDiagram)).toBe('ObjectDiagram');
    expect(toSupportedDiagramType(UMLDiagramType.StateMachineDiagram)).toBe('StateMachineDiagram');
    expect(toSupportedDiagramType(UMLDiagramType.AgentDiagram)).toBe('AgentDiagram');
  });

  it('falls back to ClassDiagram for unrecognized types', () => {
    expect(toSupportedDiagramType(UMLDiagramType.UseCaseDiagram)).toBe('ClassDiagram');
    expect(toSupportedDiagramType(UMLDiagramType.ActivityDiagram)).toBe('ClassDiagram');
  });
});

describe('toUMLDiagramType', () => {
  it('maps SupportedDiagramTypes to UMLDiagramType', () => {
    expect(toUMLDiagramType('ClassDiagram')).toBe(UMLDiagramType.ClassDiagram);
    expect(toUMLDiagramType('ObjectDiagram')).toBe(UMLDiagramType.ObjectDiagram);
    expect(toUMLDiagramType('StateMachineDiagram')).toBe(UMLDiagramType.StateMachineDiagram);
    expect(toUMLDiagramType('AgentDiagram')).toBe(UMLDiagramType.AgentDiagram);
  });

  it('returns null for diagram types without a UML equivalent', () => {
    expect(toUMLDiagramType('GUINoCodeDiagram')).toBeNull();
    expect(toUMLDiagramType('QuantumCircuitDiagram')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getActiveDiagram
// ────────────────────────────────────────────────────────────────────────────

describe('getActiveDiagram', () => {
  it('returns the diagram at the current index', () => {
    const project = createDefaultProject('P', '', '');
    const diagram = getActiveDiagram(project, 'ClassDiagram');

    expect(diagram).toBeDefined();
    expect(diagram).toBe(project.diagrams.ClassDiagram[0]);
  });

  it('returns first diagram when index is out of bounds', () => {
    const project = createDefaultProject('P', '', '');
    project.currentDiagramIndices.ClassDiagram = 99;

    const diagram = getActiveDiagram(project, 'ClassDiagram');
    expect(diagram).toBe(project.diagrams.ClassDiagram[0]);
  });

  it('returns undefined when there are no diagrams of a type', () => {
    const project = createDefaultProject('P', '', '');
    (project.diagrams as any).ClassDiagram = [];

    expect(getActiveDiagram(project, 'ClassDiagram')).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// getReferencedDiagram
// ────────────────────────────────────────────────────────────────────────────

describe('getReferencedDiagram', () => {
  it('returns diagram by reference ID when present', () => {
    const project = createDefaultProject('P', '', '');
    const classDiagram = project.diagrams.ClassDiagram[0];
    const guiDiagram = project.diagrams.GUINoCodeDiagram[0];
    guiDiagram.references = { ClassDiagram: classDiagram.id };

    const result = getReferencedDiagram(project, guiDiagram, 'ClassDiagram');
    expect(result).toBe(classDiagram);
  });

  it('falls back to active index when referenced ID is not found', () => {
    const project = createDefaultProject('P', '', '');
    const guiDiagram = project.diagrams.GUINoCodeDiagram[0];
    guiDiagram.references = { ClassDiagram: 'non-existent-id' };

    const result = getReferencedDiagram(project, guiDiagram, 'ClassDiagram');
    expect(result).toBe(project.diagrams.ClassDiagram[0]);
  });

  it('returns undefined when there are no diagrams of the referenced type', () => {
    const project = createDefaultProject('P', '', '');
    (project.diagrams as any).ClassDiagram = [];

    const result = getReferencedDiagram(project, project.diagrams.GUINoCodeDiagram[0], 'ClassDiagram');
    expect(result).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// ensureProjectMigrated
// ────────────────────────────────────────────────────────────────────────────

describe('ensureProjectMigrated', () => {
  it('adds QuantumCircuitDiagram if missing', () => {
    const project = createDefaultProject('P', '', '');
    delete (project.diagrams as any).QuantumCircuitDiagram;

    const migrated = ensureProjectMigrated(project);
    expect(migrated.diagrams.QuantumCircuitDiagram).toBeDefined();
    expect(migrated.diagrams.QuantumCircuitDiagram.length).toBeGreaterThanOrEqual(1);
  });

  it('migrates v1 single-diagram-per-type to arrays', () => {
    const project = createDefaultProject('P', '', '');
    // Simulate a v1 project: single diagrams instead of arrays
    const v1 = {
      ...project,
      schemaVersion: 1,
      diagrams: {
        ClassDiagram: project.diagrams.ClassDiagram[0],
        ObjectDiagram: project.diagrams.ObjectDiagram[0],
        StateMachineDiagram: project.diagrams.StateMachineDiagram[0],
        AgentDiagram: project.diagrams.AgentDiagram[0],
        GUINoCodeDiagram: project.diagrams.GUINoCodeDiagram[0],
        QuantumCircuitDiagram: project.diagrams.QuantumCircuitDiagram[0],
      },
    };

    const migrated = ensureProjectMigrated(v1 as any);
    expect(migrated.schemaVersion).toBeGreaterThanOrEqual(2);

    for (const type of ALL_DIAGRAM_TYPES) {
      expect(Array.isArray(migrated.diagrams[type])).toBe(true);
      expect(migrated.diagrams[type].length).toBeGreaterThanOrEqual(1);
    }
  });

  it('does not modify a current-version project', () => {
    const project = createDefaultProject('P', '', '');
    const originalId = project.id;

    const migrated = ensureProjectMigrated(project);
    expect(migrated.id).toBe(originalId);
    expect(migrated.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Type guard helpers
// ────────────────────────────────────────────────────────────────────────────

describe('isUMLModel', () => {
  it('returns true for a valid UML model shape', () => {
    expect(
      isUMLModel({
        type: 'ClassDiagram',
        version: '3.0.0',
        elements: {},
        relationships: {},
      }),
    ).toBe(true);
  });

  it('returns false for non-objects', () => {
    expect(isUMLModel(null)).toBe(false);
    expect(isUMLModel('string')).toBe(false);
    expect(isUMLModel(undefined)).toBe(false);
  });

  it('returns false when required fields are missing', () => {
    expect(isUMLModel({ type: 'ClassDiagram' })).toBe(false);
    expect(isUMLModel({ version: '3.0.0', elements: {} })).toBe(false);
  });
});

describe('isGrapesJSProjectData', () => {
  it('returns true when pages array is present', () => {
    expect(isGrapesJSProjectData({ pages: [] })).toBe(true);
    expect(isGrapesJSProjectData({ pages: [{ name: 'Home' }] })).toBe(true);
  });

  it('returns false for non-objects or missing pages', () => {
    expect(isGrapesJSProjectData(null)).toBe(false);
    expect(isGrapesJSProjectData({})).toBe(false);
    expect(isGrapesJSProjectData({ pages: 'not-an-array' })).toBe(false);
  });
});

describe('isQuantumCircuitData', () => {
  it('returns true when cols array is present', () => {
    expect(isQuantumCircuitData({ cols: [] })).toBe(true);
    expect(isQuantumCircuitData({ cols: [[1, 'H']], gates: [] })).toBe(true);
  });

  it('returns false for non-objects or missing cols', () => {
    expect(isQuantumCircuitData(null)).toBe(false);
    expect(isQuantumCircuitData({})).toBe(false);
  });
});

describe('normalizeToGrapesJSProjectData', () => {
  it('normalizes valid data by preserving arrays', () => {
    const data = { pages: [{ name: 'P1' }], styles: ['s'], assets: [], symbols: [], version: '0.21.13' };
    const result = normalizeToGrapesJSProjectData(data);

    expect(result.pages).toEqual([{ name: 'P1' }]);
    expect(result.styles).toEqual(['s']);
    expect(result.version).toBe('0.21.13');
  });

  it('provides defaults for missing or invalid fields', () => {
    const result = normalizeToGrapesJSProjectData({});

    expect(result.pages).toEqual([]);
    expect(result.styles).toEqual([]);
    expect(result.assets).toEqual([]);
    expect(result.symbols).toEqual([]);
    expect(result.version).toBe('0.21.13');
  });

  it('handles null / undefined input gracefully', () => {
    const result = normalizeToGrapesJSProjectData(null);
    expect(result.pages).toEqual([]);
    expect(result.version).toBe('0.21.13');
  });
});
