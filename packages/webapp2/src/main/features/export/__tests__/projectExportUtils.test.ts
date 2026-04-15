import { describe, it, expect } from 'vitest';
import { UMLDiagramType } from '@besser/wme';
import {
  buildExportableProjectPayload,
  ExportableProjectPayload,
} from '../utils/projectExportUtils';
import {
  createDefaultProject,
  createEmptyDiagram,
  diagramHasContent,
  BesserProject,
  ProjectDiagram,
  GrapesJSProjectData,
  QuantumCircuitData,
  ALL_DIAGRAM_TYPES,
  SupportedDiagramType,
} from '../../../shared/types/project';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Create a UML diagram that has at least one element (i.e. non-empty). */
const createNonEmptyUMLDiagram = (
  title: string,
  type: UMLDiagramType,
): ProjectDiagram => {
  const diagram = createEmptyDiagram(title, type);
  const model = diagram.model as any;
  model.elements = {
    'element-1': {
      id: 'element-1',
      name: 'TestClass',
      type: 'Class',
      owner: null,
      bounds: { x: 100, y: 100, width: 200, height: 100 },
    },
  };
  return diagram;
};

/** Create a GrapesJS GUI diagram that has at least one component (i.e. non-empty). */
const createNonEmptyGUIDiagram = (title: string): ProjectDiagram => {
  const diagram = createEmptyDiagram(title, null, 'gui');
  const model = diagram.model as GrapesJSProjectData;
  model.pages[0].frames[0].component.components = [
    { type: 'text', content: 'Hello' },
  ];
  return diagram;
};

/** Create a quantum circuit diagram that has at least one column (i.e. non-empty). */
const createNonEmptyQuantumDiagram = (title: string): ProjectDiagram => {
  const diagram = createEmptyDiagram(title, null, 'quantum');
  const model = diagram.model as QuantumCircuitData;
  model.cols = [['H', 1]];
  return diagram;
};

// ────────────────────────────────────────────────────────────────────────────
// diagramHasContent
// ────────────────────────────────────────────────────────────────────────────

describe('diagramHasContent', () => {
  it('returns false for empty UML diagram (no elements, no relationships)', () => {
    const diagram = createEmptyDiagram('Class Diagram', UMLDiagramType.ClassDiagram);
    expect(diagramHasContent(diagram)).toBe(false);
  });

  it('returns true for UML diagram with elements', () => {
    const diagram = createNonEmptyUMLDiagram('Class Diagram', UMLDiagramType.ClassDiagram);
    expect(diagramHasContent(diagram)).toBe(true);
  });

  it('returns true for UML diagram with only relationships', () => {
    const diagram = createEmptyDiagram('Class Diagram', UMLDiagramType.ClassDiagram);
    const model = diagram.model as any;
    model.relationships = {
      'rel-1': { id: 'rel-1', type: 'ClassBidirectional' },
    };
    expect(diagramHasContent(diagram)).toBe(true);
  });

  it('returns false for empty GrapesJS GUI diagram', () => {
    const diagram = createEmptyDiagram('GUI Diagram', null, 'gui');
    expect(diagramHasContent(diagram)).toBe(false);
  });

  it('returns true for GrapesJS diagram with components', () => {
    const diagram = createNonEmptyGUIDiagram('GUI Diagram');
    expect(diagramHasContent(diagram)).toBe(true);
  });

  it('returns false for empty quantum circuit (no cols)', () => {
    const diagram = createEmptyDiagram('Quantum Circuit', null, 'quantum');
    expect(diagramHasContent(diagram)).toBe(false);
  });

  it('returns true for quantum circuit with cols', () => {
    const diagram = createNonEmptyQuantumDiagram('Quantum Circuit');
    expect(diagramHasContent(diagram)).toBe(true);
  });

  it('returns false when model is undefined', () => {
    const diagram: ProjectDiagram = {
      id: 'no-model',
      title: 'No Model',
      lastUpdate: new Date().toISOString(),
    };
    expect(diagramHasContent(diagram)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// buildExportableProjectPayload
// ────────────────────────────────────────────────────────────────────────────

describe('buildExportableProjectPayload', () => {
  it('filters out diagram types where ALL diagrams are empty', () => {
    const project = createDefaultProject('Test Project', 'desc', 'owner');
    // Default project has all empty diagrams
    const payload = buildExportableProjectPayload(project);

    // Every default diagram is empty, so diagrams record should have no keys
    expect(Object.keys(payload.diagrams)).toHaveLength(0);
  });

  it('keeps diagram types with at least one non-empty diagram', () => {
    const project = createDefaultProject('Test Project', 'desc', 'owner');

    // Add a non-empty class diagram
    project.diagrams.ClassDiagram = [
      createNonEmptyUMLDiagram('My Class Diagram', UMLDiagramType.ClassDiagram),
    ];

    const payload = buildExportableProjectPayload(project);

    expect(payload.diagrams['ClassDiagram']).toBeDefined();
    expect(payload.diagrams['ClassDiagram']).toHaveLength(1);
    // Other types remain empty, so they should be excluded
    expect(payload.diagrams['ObjectDiagram']).toBeUndefined();
    expect(payload.diagrams['StateMachineDiagram']).toBeUndefined();
    expect(payload.diagrams['AgentDiagram']).toBeUndefined();
    expect(payload.diagrams['GUINoCodeDiagram']).toBeUndefined();
    expect(payload.diagrams['QuantumCircuitDiagram']).toBeUndefined();
  });

  it('keeps only non-empty diagrams within a type that has a mix', () => {
    const project = createDefaultProject('Test Project', 'desc', 'owner');

    // Mix of empty and non-empty class diagrams
    project.diagrams.ClassDiagram = [
      createEmptyDiagram('Empty Class', UMLDiagramType.ClassDiagram),
      createNonEmptyUMLDiagram('Full Class', UMLDiagramType.ClassDiagram),
      createEmptyDiagram('Another Empty', UMLDiagramType.ClassDiagram),
    ];

    const payload = buildExportableProjectPayload(project);

    expect(payload.diagrams['ClassDiagram']).toBeDefined();
    expect(payload.diagrams['ClassDiagram']).toHaveLength(1);
    expect(payload.diagrams['ClassDiagram'][0].title).toBe('Full Class');
  });

  it('works with selectedDiagramTypes filter', () => {
    const project = createDefaultProject('Test Project', 'desc', 'owner');

    // Make both ClassDiagram and StateMachineDiagram non-empty
    project.diagrams.ClassDiagram = [
      createNonEmptyUMLDiagram('Class', UMLDiagramType.ClassDiagram),
    ];
    project.diagrams.StateMachineDiagram = [
      createNonEmptyUMLDiagram('SM', UMLDiagramType.StateMachineDiagram),
    ];

    // Only select ClassDiagram
    const payload = buildExportableProjectPayload(project, ['ClassDiagram']);

    expect(payload.diagrams['ClassDiagram']).toBeDefined();
    expect(payload.diagrams['StateMachineDiagram']).toBeUndefined();
  });

  it('selectedDiagramTypes filter still applies empty-diagram filtering', () => {
    const project = createDefaultProject('Test Project', 'desc', 'owner');
    // ClassDiagram is empty (default)

    const payload = buildExportableProjectPayload(project, ['ClassDiagram']);

    // Even though ClassDiagram is selected, it is empty so it should be excluded
    expect(payload.diagrams['ClassDiagram']).toBeUndefined();
    expect(Object.keys(payload.diagrams)).toHaveLength(0);
  });

  it('normalizes project name (trims and collapses whitespace to single underscores)', () => {
    const project = createDefaultProject('  My  Cool  Project  ', 'desc', 'owner');
    const payload = buildExportableProjectPayload(project);

    // normalizeProjectName trims then replaces each whitespace run with a single underscore
    expect(payload.name).toBe('My_Cool_Project');
  });

  it('uses "project" as default name when name is empty', () => {
    const project = createDefaultProject('', 'desc', 'owner');
    project.name = '';
    const payload = buildExportableProjectPayload(project);

    expect(payload.name).toBe('project');
  });

  it('preserves project metadata (id, type, schemaVersion, etc.)', () => {
    const project = createDefaultProject('Meta Test', 'a description', 'alice');
    const payload = buildExportableProjectPayload(project);

    expect(payload.id).toBe(project.id);
    expect(payload.type).toBe('Project');
    expect(payload.schemaVersion).toBe(project.schemaVersion);
    expect(payload.description).toBe('a description');
    expect(payload.owner).toBe('alice');
  });

  it('does not mutate the original project', () => {
    const project = createDefaultProject('Original', 'desc', 'owner');
    project.diagrams.ClassDiagram = [
      createNonEmptyUMLDiagram('Class', UMLDiagramType.ClassDiagram),
    ];

    const originalDiagramCount = Object.keys(project.diagrams).length;
    buildExportableProjectPayload(project);

    // Original project should still have all supported diagram types
    expect(Object.keys(project.diagrams)).toHaveLength(originalDiagramCount);
    expect(project.name).toBe('Original');
  });

  it('handles multiple non-empty diagram types', () => {
    const project = createDefaultProject('Multi', 'desc', 'owner');

    project.diagrams.ClassDiagram = [
      createNonEmptyUMLDiagram('Class', UMLDiagramType.ClassDiagram),
    ];
    project.diagrams.GUINoCodeDiagram = [
      createNonEmptyGUIDiagram('GUI'),
    ];
    project.diagrams.QuantumCircuitDiagram = [
      createNonEmptyQuantumDiagram('Quantum'),
    ];

    const payload = buildExportableProjectPayload(project);

    expect(Object.keys(payload.diagrams)).toHaveLength(3);
    expect(payload.diagrams['ClassDiagram']).toBeDefined();
    expect(payload.diagrams['GUINoCodeDiagram']).toBeDefined();
    expect(payload.diagrams['QuantumCircuitDiagram']).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Round-trip: export -> verify filtering -> simulate import with fillMissing
// ────────────────────────────────────────────────────────────────────────────

describe('round-trip: export filters empty diagrams, import restores them', () => {
  /**
   * Simulates what fillMissingDiagrams does in useImportProject.ts:
   * ensures every SupportedDiagramType exists as an array with at least one diagram.
   */
  const fillMissingDiagrams = (project: BesserProject): BesserProject => {
    const diagramTypeToUMLType: Record<SupportedDiagramType, UMLDiagramType | null> = {
      ClassDiagram: UMLDiagramType.ClassDiagram,
      ObjectDiagram: UMLDiagramType.ObjectDiagram,
      StateMachineDiagram: UMLDiagramType.StateMachineDiagram,
      AgentDiagram: UMLDiagramType.AgentDiagram,
      UserDiagram: UMLDiagramType.UserDiagram,
      GUINoCodeDiagram: null,
      QuantumCircuitDiagram: null,
    };
    const diagramTitles: Record<SupportedDiagramType, string> = {
      ClassDiagram: 'Class Diagram',
      ObjectDiagram: 'Object Diagram',
      StateMachineDiagram: 'State Machine Diagram',
      AgentDiagram: 'Agent Diagram',
      UserDiagram: 'User Diagram',
      GUINoCodeDiagram: 'GUI Diagram',
      QuantumCircuitDiagram: 'Quantum Circuit',
    };
    const diagramKinds: Partial<Record<SupportedDiagramType, 'gui' | 'quantum'>> = {
      GUINoCodeDiagram: 'gui',
      QuantumCircuitDiagram: 'quantum',
    };

    for (const diagramType of ALL_DIAGRAM_TYPES) {
      const existing = (project.diagrams as any)[diagramType];
      if (!existing) {
        const umlType = diagramTypeToUMLType[diagramType];
        const title = diagramTitles[diagramType];
        const kind = diagramKinds[diagramType];
        (project.diagrams as any)[diagramType] = [createEmptyDiagram(title, umlType, kind)];
      } else if (!Array.isArray(existing)) {
        (project.diagrams as any)[diagramType] = [existing];
      }
    }
    return project;
  };

  it('export excludes empty diagrams, fillMissingDiagrams restores all types on import', () => {
    // 1. Create a project with only ClassDiagram having content
    const project = createDefaultProject('Round Trip', 'test', 'owner');
    project.diagrams.ClassDiagram = [
      createNonEmptyUMLDiagram('My Class', UMLDiagramType.ClassDiagram),
    ];

    // 2. Export: empty diagram types should be filtered out
    const exported = buildExportableProjectPayload(project);
    expect(Object.keys(exported.diagrams)).toHaveLength(1);
    expect(exported.diagrams['ClassDiagram']).toBeDefined();
    expect(exported.diagrams['ObjectDiagram']).toBeUndefined();
    expect(exported.diagrams['GUINoCodeDiagram']).toBeUndefined();
    expect(exported.diagrams['QuantumCircuitDiagram']).toBeUndefined();

    // 3. Simulate import: reconstruct BesserProject from exported payload
    const imported: BesserProject = {
      ...exported,
      diagrams: exported.diagrams as any,
    };

    // 4. fillMissingDiagrams restores all diagram types
    const restored = fillMissingDiagrams(imported);

    for (const type of ALL_DIAGRAM_TYPES) {
      expect(restored.diagrams[type]).toBeDefined();
      expect(Array.isArray(restored.diagrams[type])).toBe(true);
      expect(restored.diagrams[type].length).toBeGreaterThanOrEqual(1);
    }

    // 5. The original non-empty ClassDiagram content is preserved
    const classModel = restored.diagrams.ClassDiagram[0].model as any;
    expect(classModel.elements).toBeDefined();
    expect(Object.keys(classModel.elements).length).toBeGreaterThan(0);
  });

  it('fully empty project round-trips: export has no diagrams, import restores all empty', () => {
    const project = createDefaultProject('Empty Project', '', 'owner');

    // Export: all empty -> no diagram types in payload
    const exported = buildExportableProjectPayload(project);
    expect(Object.keys(exported.diagrams)).toHaveLength(0);

    // Import: fillMissingDiagrams restores all types
    const imported: BesserProject = {
      ...exported,
      diagrams: exported.diagrams as any,
    };
    const restored = fillMissingDiagrams(imported);

    for (const type of ALL_DIAGRAM_TYPES) {
      expect(restored.diagrams[type]).toBeDefined();
      expect(restored.diagrams[type]).toHaveLength(1);
    }
  });
});
