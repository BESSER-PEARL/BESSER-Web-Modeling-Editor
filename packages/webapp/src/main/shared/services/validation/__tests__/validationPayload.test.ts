import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UMLDiagramType, type UMLModel } from '@besser/wme';
import {
  type BesserProject,
  createDefaultProject,
  createEmptyDiagram,
} from '../../../types/project';
import { ProjectStorageRepository } from '../../storage/ProjectStorageRepository';
import { withReferenceDiagramData } from '../validationPayload';
import { validateDiagram } from '../validateDiagram';

/**
 * Apollon-parity: develop's editor embedded the linked ClassDiagram as
 * `model.referenceDiagramData` for ObjectDiagrams (model-state.ts via the
 * diagram bridge). The backend's /validate-diagram rejects ObjectDiagram
 * payloads without it, which used to block generation/export/deploy
 * pre-gates. These tests pin the webapp-side payload builder that restores
 * that behavior.
 */

const markedClassModel = (marker: string): UMLModel =>
  ({
    ...(createEmptyDiagram('Classes', UMLDiagramType.ClassDiagram).model as UMLModel),
    nodes: [
      {
        id: marker,
        type: 'class',
        position: { x: 0, y: 0 },
        width: 200,
        height: 100,
        data: { name: marker, attributes: [], methods: [] },
      } as any,
    ],
  }) as UMLModel;

const objectModel = (): Record<string, any> => ({
  version: '4.0.0',
  id: 'object-model-1',
  title: 'Objects',
  type: 'ObjectDiagram',
  nodes: [
    {
      id: 'obj-1',
      type: 'objectName',
      position: { x: 0, y: 0 },
      data: { name: 'o1', attributes: [] },
    },
  ],
  edges: [],
});

const projectWithMarkedClassDiagram = (marker = 'class-A'): BesserProject => {
  const project = createDefaultProject('Test Project', '', 'me');
  project.diagrams.ClassDiagram[0].model = markedClassModel(marker);
  return project;
};

describe('withReferenceDiagramData', () => {
  it('embeds the active ClassDiagram model for an ObjectDiagram', () => {
    const project = projectWithMarkedClassDiagram('class-A');
    const model = objectModel();

    const result = withReferenceDiagramData(model, project);

    expect(result.referenceDiagramData).toEqual(project.diagrams.ClassDiagram[0].model);
    expect((result.referenceDiagramData as any).nodes[0].id).toBe('class-A');
  });

  it('resolves the per-diagram reference ID before the active index', () => {
    const project = projectWithMarkedClassDiagram('class-A');
    const second = createEmptyDiagram('Classes 2', UMLDiagramType.ClassDiagram);
    second.model = markedClassModel('class-B');
    project.diagrams.ClassDiagram.push(second);
    project.currentDiagramIndices.ClassDiagram = 0;
    project.diagrams.ObjectDiagram[0].references = { ClassDiagram: second.id };

    const result = withReferenceDiagramData(objectModel(), project);

    expect((result.referenceDiagramData as any).nodes[0].id).toBe('class-B');
  });

  it('falls back to currentDiagramIndices when the reference points at a deleted diagram', () => {
    const project = projectWithMarkedClassDiagram('class-A');
    const second = createEmptyDiagram('Classes 2', UMLDiagramType.ClassDiagram);
    second.model = markedClassModel('class-B');
    project.diagrams.ClassDiagram.push(second);
    project.currentDiagramIndices.ClassDiagram = 1;
    project.diagrams.ObjectDiagram[0].references = { ClassDiagram: 'deleted-diagram-id' };

    const result = withReferenceDiagramData(objectModel(), project);

    expect((result.referenceDiagramData as any).nodes[0].id).toBe('class-B');
  });

  it('does not mutate the input model', () => {
    const project = projectWithMarkedClassDiagram();
    const model = objectModel();

    const result = withReferenceDiagramData(model, project);

    expect(result).not.toBe(model);
    expect(model.referenceDiagramData).toBeUndefined();
  });

  it('leaves non-ObjectDiagram models untouched (ClassDiagram, UserDiagram)', () => {
    const project = projectWithMarkedClassDiagram();
    const classModel = { ...objectModel(), type: 'ClassDiagram' };
    // UserDiagram validates against the backend's preset reference model.
    const userModel = { ...objectModel(), type: 'UserDiagram' };

    expect(withReferenceDiagramData(classModel, project)).toBe(classModel);
    expect(withReferenceDiagramData(userModel, project)).toBe(userModel);
    expect((classModel as any).referenceDiagramData).toBeUndefined();
    expect((userModel as any).referenceDiagramData).toBeUndefined();
  });

  it('preserves an already-attached referenceDiagramData', () => {
    const project = projectWithMarkedClassDiagram('class-A');
    const preAttached = markedClassModel('pre-attached');
    const model = { ...objectModel(), referenceDiagramData: preAttached };

    const result = withReferenceDiagramData(model, project);

    expect(result).toBe(model);
    expect((result.referenceDiagramData as any).nodes[0].id).toBe('pre-attached');
  });

  it('returns the model unchanged when there is no project', () => {
    const model = objectModel();
    expect(withReferenceDiagramData(model, null)).toBe(model);
    expect(withReferenceDiagramData(model, undefined)).toBe(model);
  });

  it('returns the model unchanged when no ClassDiagram can be resolved', () => {
    const project = projectWithMarkedClassDiagram();
    project.diagrams.ClassDiagram = [];
    const model = objectModel();

    const result = withReferenceDiagramData(model, project);

    expect(result).toBe(model);
    expect(result.referenceDiagramData).toBeUndefined();
  });
});

describe('validateDiagram payload (ObjectDiagram pre-gate)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ isValid: true, errors: [], warnings: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  const sentBody = (): any => {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    return JSON.parse(fetchMock.mock.calls[0][1].body);
  };

  it('attaches referenceDiagramData to ObjectDiagram validation requests', async () => {
    const project = projectWithMarkedClassDiagram('class-A');
    ProjectStorageRepository.saveProject(project);

    const result = await validateDiagram(null, 'Objects', { ...objectModel(), _suppressToasts: true });

    const body = sentBody();
    expect(body.model.type).toBe('ObjectDiagram');
    expect(body.model.referenceDiagramData).toBeDefined();
    expect(body.model.referenceDiagramData.nodes[0].id).toBe('class-A');
    expect(result.isValid).toBe(true);
  });

  it('does not attach referenceDiagramData to ClassDiagram validation requests', async () => {
    const project = projectWithMarkedClassDiagram('class-A');
    ProjectStorageRepository.saveProject(project);

    await validateDiagram(null, 'Classes', {
      ...objectModel(),
      type: 'ClassDiagram',
      _suppressToasts: true,
    });

    const body = sentBody();
    expect(body.model.type).toBe('ClassDiagram');
    expect(body.model.referenceDiagramData).toBeUndefined();
  });

  it('strips the _suppressToasts marker from the payload', async () => {
    const project = projectWithMarkedClassDiagram('class-A');
    ProjectStorageRepository.saveProject(project);

    await validateDiagram(null, 'Objects', { ...objectModel(), _suppressToasts: true });

    const body = sentBody();
    expect(body.model._suppressToasts).toBeUndefined();
  });
});
