/**
 * SA-FINAL-3 Task 6 + 8: v3-acceptance helper used by useImportDiagram
 * and useImportDiagramToProject. Exercises the migrate-before-validate
 * branch on representative input shapes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-toastify before importing the module under test so the
// helper's toast.info call lands on our spy.
const toastInfo = vi.fn();
const toastError = vi.fn();
vi.mock('react-toastify', () => ({
  toast: {
    info: (...args: any[]) => toastInfo(...args),
    error: (...args: any[]) => toastError(...args),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { maybeMigrateImportedDiagram } from '../useImportDiagram';
import { isUMLModel } from '../../../shared/types/project';

const v3ClassDiagramJSON = () => ({
  id: 'd-1',
  title: 'Legacy Class',
  lastUpdate: '2024-01-01T00:00:00.000Z',
  model: {
    // v3 shape: elements + relationships records, no nodes/edges arrays.
    version: '3.0.0',
    type: 'ClassDiagram',
    elements: {
      'el-1': {
        id: 'el-1',
        type: 'Class',
        name: 'Foo',
        bounds: { x: 0, y: 0, width: 200, height: 80 },
        attributes: [],
        methods: [],
      },
    },
    relationships: {},
  },
});

const v4ClassDiagram = () => ({
  id: 'd-2',
  title: 'Modern Class',
  lastUpdate: '2024-06-01T00:00:00.000Z',
  model: {
    version: '4.0.0',
    id: 'm-1',
    title: 'Modern Class',
    type: 'ClassDiagram',
    nodes: [],
    edges: [],
    interactive: { elements: {}, relationships: {} },
    assessments: {},
  },
});

describe('maybeMigrateImportedDiagram', () => {
  beforeEach(() => {
    toastInfo.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes through v4 input unchanged and emits no toast', () => {
    const v4 = v4ClassDiagram();
    const result = maybeMigrateImportedDiagram(v4 as any);
    expect(result).toBe(v4); // exact same reference
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('migrates v3 input to v4 and surfaces a user-visible info toast', () => {
    const v3 = v3ClassDiagramJSON();
    const result = maybeMigrateImportedDiagram(v3 as any);
    // After migration the new diagram must validate as a v4 UMLModel.
    expect(isUMLModel(result.model)).toBe(true);
    const model = result.model as any;
    expect(Array.isArray(model.nodes)).toBe(true);
    expect(Array.isArray(model.edges)).toBe(true);
    // The migration toast was emitted exactly once.
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(String(toastInfo.mock.calls[0]?.[0])).toMatch(/v3 schema/i);
  });

  it("migrates a single v3 BPMN diagram stored with the old editor's 'BPMNDiagram' type", () => {
    const v3Bpmn = {
      id: 'bp-1',
      title: 'Legacy BPMN',
      lastUpdate: '2024-01-01T00:00:00.000Z',
      model: {
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 0, height: 0 },
        interactive: { elements: {}, relationships: {} },
        elements: {
          g1: { id: 'g1', name: '', type: 'BPMNGateway', owner: null, bounds: { x: 0, y: 0, width: 40, height: 40 }, gatewayType: 'exclusive' },
          t1: { id: 't1', name: 'A', type: 'BPMNTask', owner: null, bounds: { x: 100, y: 0, width: 100, height: 60 }, taskType: 'default', marker: 'none' },
          t2: { id: 't2', name: 'B', type: 'BPMNTask', owner: null, bounds: { x: 100, y: 100, width: 100, height: 60 }, taskType: 'default', marker: 'none' },
        },
        relationships: {
          f1: { id: 'f1', name: '', type: 'BPMNFlow', owner: null, bounds: { x: 0, y: 0, width: 0, height: 0 }, path: [], source: { element: 'g1', direction: 'Right' }, target: { element: 't1', direction: 'Left' }, flowType: 'sequence', isDefault: true },
          f2: { id: 'f2', name: '', type: 'BPMNFlow', owner: null, bounds: { x: 0, y: 0, width: 0, height: 0 }, path: [], source: { element: 't1', direction: 'Down' }, target: { element: 't2', direction: 'Up' }, flowType: 'data association' },
        },
        assessments: {},
      },
    };
    const result = maybeMigrateImportedDiagram(v3Bpmn as any);
    expect(isUMLModel(result.model)).toBe(true);
    const model = result.model as any;
    expect(model.type).toBe('BPMNDiagram');
    const edges = Object.fromEntries(model.edges.map((e: any) => [e.id, e]));
    expect(edges.f1.type).toBe('BPMNSequenceFlow');
    expect(edges.f1.data.isDefault).toBe(true);
    expect(edges.f2.type).toBe('BPMNDataAssociationFlow');
    expect(toastInfo).toHaveBeenCalledTimes(1);
  });

  it('does not touch diagrams whose model is missing entirely', () => {
    const noModel = { id: 'x', title: 'NoModel', lastUpdate: '2024-01-01T00:00:00.000Z' };
    const result = maybeMigrateImportedDiagram(noModel as any);
    expect(result).toBe(noModel);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('lets migration failures propagate so the importer rejects bad data with a clear error', () => {
    const broken = {
      id: 'b',
      title: 'Broken',
      lastUpdate: '2024-01-01T00:00:00.000Z',
      model: {
        // v3 detector matches (elements + relationships) but `type` is
        // unknown — the migrator will throw on the unsupported kind.
        version: '3.0.0',
        type: 'NotARealDiagramType',
        elements: {},
        relationships: {},
      },
    };
    expect(() => maybeMigrateImportedDiagram(broken as any)).toThrow(
      /Unsupported diagram type/i,
    );
    // No info toast on failure — the importer reports the error in its
    // own catch block via the existing `displayError` flow.
    expect(toastInfo).not.toHaveBeenCalled();
  });
});
