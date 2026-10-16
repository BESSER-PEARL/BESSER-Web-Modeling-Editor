import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importProjectFromJson } from '../projectImport';
import { ProjectStorageRepository } from '../../storage/ProjectStorageRepository';
import { buildProjectExportEnvelope } from '../../../utils/projectExportUtils';
import {
  ALL_DIAGRAM_TYPES,
  createDefaultProject,
  isGrapesJSProjectData,
  isKnowledgeGraphData,
  isQuantumCircuitData,
  type BesserProject,
  type KnowledgeGraphData,
} from '../../../types/project';

vi.mock('../../../../features/assistant/hooks/useModelInjection', () => ({ centerEditorViewport: vi.fn() }));

const asFile = (value: unknown) => new File([JSON.stringify(value)], 'project.json', { type: 'application/json' });

const kgModel = (): KnowledgeGraphData => ({
  type: 'KnowledgeGraphDiagram',
  version: '1.0.0',
  nodes: [{ id: 'n1', nodeType: 'class', label: 'Person', iri: 'http://ex.org/onto#Person' }],
  edges: [],
});

describe('importProjectFromJson: empty diagrams are re-created with the right model', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Export strips empty diagrams, so every re-imported project goes through the
  // "fill the missing ones" step for the types the user never touched.
  const exportedAndReimported = async (project: BesserProject): Promise<BesserProject> =>
    importProjectFromJson(asFile(buildProjectExportEnvelope(project, undefined, { includePersonalization: false })));

  it('gives the Knowledge Graph slot a knowledge-graph model, not a GrapesJS one', async () => {
    const imported = await exportedAndReimported(createDefaultProject('P', '', 'me'));

    const model = imported.diagrams.KnowledgeGraphDiagram[0].model;
    expect(isKnowledgeGraphData(model)).toBe(true);
    expect(isGrapesJSProjectData(model)).toBe(false);
    expect(model).toMatchObject({ type: 'KnowledgeGraphDiagram', nodes: [], edges: [] });
  });

  it('still gives the GUI and Quantum slots their own models', async () => {
    const imported = await exportedAndReimported(createDefaultProject('P', '', 'me'));

    expect(isGrapesJSProjectData(imported.diagrams.GUINoCodeDiagram[0].model)).toBe(true);
    expect(isQuantumCircuitData(imported.diagrams.QuantumCircuitDiagram[0].model)).toBe(true);
  });

  it('keeps a Knowledge Graph diagram that has content', async () => {
    const project = createDefaultProject('P', '', 'me');
    project.diagrams.KnowledgeGraphDiagram[0] = { ...project.diagrams.KnowledgeGraphDiagram[0], model: kgModel() };

    const imported = await exportedAndReimported(project);

    expect(imported.diagrams.KnowledgeGraphDiagram[0].model).toEqual(kgModel());
  });

  it('persists the filled project, so the editor loads the same thing', async () => {
    const imported = await exportedAndReimported(createDefaultProject('P', '', 'me'));

    const stored = ProjectStorageRepository.loadProject(imported.id)!;
    expect(isKnowledgeGraphData(stored.diagrams.KnowledgeGraphDiagram[0].model)).toBe(true);
  });

  it('fills every other type of a single-diagram file too', async () => {
    const single = { title: 'Solo', model: { type: 'ClassDiagram', elements: {}, relationships: {} } };

    const imported = await importProjectFromJson(asFile(single));

    for (const type of ALL_DIAGRAM_TYPES) expect(imported.diagrams[type].length).toBeGreaterThanOrEqual(1);
    expect(isKnowledgeGraphData(imported.diagrams.KnowledgeGraphDiagram[0].model)).toBe(true);
  });
});
