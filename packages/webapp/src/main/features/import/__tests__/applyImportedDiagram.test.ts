/**
 * Wave-3 Item E regression: `project.diagrams[type]` must stay a
 * `ProjectDiagram[]` array when applying assistant imports (KG / image).
 * The KG hook used to write a bare object into the type bucket, clobbering
 * every existing diagram of that type and breaking `getActiveDiagram`'s
 * array indexing (the imported diagram never loaded).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-toastify before importing the module under test so the
// helper's toast.error call lands on our spy (arrow defers the deref to
// call time — same pattern as useImportDiagram.test.ts).
const toastError = vi.fn();
vi.mock('react-toastify', () => ({
  toast: {
    error: (...args: any[]) => toastError(...args),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { applyImportedDiagramToProject } from '../applyImportedDiagram';
import { createDefaultProject, isUMLModel } from '../../../shared/types/project';

type AnyModel = Record<string, any>;

const emptyV4Model = (title: string): AnyModel => ({
  version: '4.0.0',
  id: `m-${title}`,
  title,
  type: 'ClassDiagram',
  nodes: [],
  edges: [],
});

const importedV4Model = (): AnyModel => ({
  version: '4.0.0',
  id: 'm-imported',
  title: 'Imported',
  type: 'ClassDiagram',
  nodes: [
    {
      id: 'n-1',
      type: 'class',
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      data: { name: 'Library', attributes: [], methods: [] },
    },
  ],
  edges: [],
});

/** Develop-era v3 ClassDiagram model with one class. */
const v3ClassModel = (): AnyModel => ({
  version: '3.0.0',
  type: 'ClassDiagram',
  size: { width: 100, height: 100 },
  interactive: { elements: {}, relationships: {} },
  elements: {
    'el-1': {
      id: 'el-1',
      type: 'Class',
      name: 'Foo',
      owner: null,
      bounds: { x: 0, y: 0, width: 200, height: 100 },
      attributes: [],
      methods: [],
    },
  },
  relationships: {},
  assessments: {},
});

/** schemaVersion-5 project with TWO ClassDiagrams, the second one active. */
const seedProject = () => {
  const project = createDefaultProject('Seed', 'desc', 'owner');
  project.diagrams.ClassDiagram = [
    { id: 'cd-0', title: 'First', model: emptyV4Model('First') as any, lastUpdate: '2024-01-01T00:00:00.000Z' },
    { id: 'cd-1', title: 'Second', model: emptyV4Model('Second') as any, lastUpdate: '2024-01-02T00:00:00.000Z' },
  ];
  project.currentDiagramIndices.ClassDiagram = 1;
  return project;
};

describe('applyImportedDiagramToProject', () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it('replaces the active entry while preserving the ProjectDiagram[] array', () => {
    const project = seedProject();
    const untouched = project.diagrams.ClassDiagram[0];

    const { project: updated, diagramType, diagramTitle } = applyImportedDiagramToProject(
      project,
      { title: 'KG Import', model: importedV4Model() },
      { fallbackTitle: 'kg.ttl', source: 'Knowledge Graph' },
    );

    // The literal bug: the bucket must stay an array.
    expect(Array.isArray(updated.diagrams.ClassDiagram)).toBe(true);
    expect(updated.diagrams.ClassDiagram).toHaveLength(2);

    // Non-active entry untouched (same reference).
    expect(updated.diagrams.ClassDiagram[0]).toBe(untouched);

    // Active entry replaced with the imported v4 model.
    const replaced = updated.diagrams.ClassDiagram[1];
    expect(replaced.title).toBe('KG Import');
    expect(replaced.model).toEqual(importedV4Model());
    expect(replaced.description).toBe('Imported ClassDiagram diagram from Knowledge Graph');

    // Indices stay coherent — still pointing at the replaced slot.
    expect(updated.currentDiagramIndices.ClassDiagram).toBe(1);
    expect(diagramType).toBe('ClassDiagram');
    expect(diagramTitle).toBe('KG Import');

    // Pure: the input project was not mutated.
    expect(project.diagrams.ClassDiagram[1].id).toBe('cd-1');
    expect(project.diagrams.ClassDiagram[1].title).toBe('Second');
  });

  it('clamps an out-of-range active index to the last entry', () => {
    const project = seedProject();
    project.currentDiagramIndices.ClassDiagram = 5;

    const { project: updated } = applyImportedDiagramToProject(
      project,
      { model: importedV4Model() },
      { fallbackTitle: 'kg.ttl', source: 'Knowledge Graph' },
    );

    expect(updated.diagrams.ClassDiagram).toHaveLength(2);
    expect(updated.diagrams.ClassDiagram[1].model).toEqual(importedV4Model());
  });

  it('pushes as the first entry when no diagram of the type exists yet', () => {
    const project = seedProject();
    project.diagrams.ClassDiagram = [];
    project.currentDiagramIndices.ClassDiagram = 0;

    const { project: updated } = applyImportedDiagramToProject(
      project,
      { model: importedV4Model() },
      { fallbackTitle: 'kg.ttl', source: 'Knowledge Graph' },
    );

    expect(Array.isArray(updated.diagrams.ClassDiagram)).toBe(true);
    expect(updated.diagrams.ClassDiagram).toHaveLength(1);
    // Coherent with the `?? 0` active index.
    expect(updated.currentDiagramIndices.ClassDiagram).toBe(0);
  });

  it('uses the fallback title when the payload carries none', () => {
    const { diagramTitle } = applyImportedDiagramToProject(
      seedProject(),
      { model: importedV4Model() },
      { fallbackTitle: 'graph.ttl', source: 'Knowledge Graph' },
    );

    expect(diagramTitle).toBe('graph.ttl');
  });

  it('lifts v3-shaped payloads to v4 before storing — never stores v3', () => {
    const { project: updated } = applyImportedDiagramToProject(
      seedProject(),
      { model: v3ClassModel() },
      { fallbackTitle: 'kg.ttl', source: 'Knowledge Graph' },
    );

    const stored = updated.diagrams.ClassDiagram[1].model as AnyModel;
    expect(isUMLModel(stored)).toBe(true);
    expect(stored.version).toBe('4.0.0');
    expect(stored.nodes).toHaveLength(1);
    expect(stored.nodes[0].data.name).toBe('Foo');
  });

  it('rejects payloads that are not valid v4 UMLModels with a toast + throw', () => {
    expect(() =>
      applyImportedDiagramToProject(
        seedProject(),
        { model: { type: 'ClassDiagram' } },
        { fallbackTitle: 'kg.ttl', source: 'Knowledge Graph' },
      ),
    ).toThrow(/not a valid v4 UMLModel/);

    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
