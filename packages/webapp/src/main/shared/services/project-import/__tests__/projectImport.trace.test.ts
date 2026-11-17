import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importProjectFromJson, importTemplateProject } from '../projectImport';
import { ProjectStorageRepository } from '../../storage/ProjectStorageRepository';
import { buildProjectExportEnvelope } from '../../../utils/projectExportUtils';
import { createDefaultProject } from '../../../types/project';
import { flushTraceSaves, loadProjectTrace, MODEL_GENERATORS, SAVE_DELAY_MS, setTraceStorage } from '../../../traceability/traceStore';
import { memoryTraceStorage } from '../../../traceability/traceDatabase';
import type { TraceStorage } from '../../../traceability/traceDatabase';
import { emptyTraceFile, isModelArtifact } from '../../../types/traceability';

vi.mock('../../../../features/assistant/hooks/useModelInjection', () => ({ centerEditorViewport: vi.fn() }));

const asFile = (value: unknown) => new File([JSON.stringify(value)], 'project.json', { type: 'application/json' });

function envelopeWithTrace() {
  const project = createDefaultProject('Library', '', 'Ada');
  const envelope = buildProjectExportEnvelope(project, undefined, { includePersonalization: false });
  const trace = { ...emptyTraceFile(project.id), actors: [{ id: 'a', type: 'Person' as const, name: 'Ada', timestamp: '2026-01-01T00:00:00.000Z' }] };
  return { ...envelope, trace };
}

describe('importing a project with its trace', () => {
  let writes: string[];
  beforeEach(() => {
    localStorage.clear();
    writes = [];
    const inner = memoryTraceStorage();
    const storage: TraceStorage = { ...inner, write: (id, trace, expected) => { writes.push(id); return inner.write(id, trace, expected); } };
    setTraceStorage(storage);
  });
  afterEach(() => vi.restoreAllMocks());

  it('stores the trace under the imported project’s new id', async () => {
    const imported = await importProjectFromJson(asFile(envelopeWithTrace()));
    await loadProjectTrace(imported.id); // the trace is stored once it has loaded
    await flushTraceSaves();
    expect(writes).toEqual([imported.id]);
    expect((await loadProjectTrace(imported.id)).actors.map((a) => a.name)).toEqual(['Ada']);
  });

  it('starts a full-project template recording, with its diagrams written by the template library', async () => {
    // Live: "Library (Full Stack)" came up with recording off and no trace at all.
    const project = createDefaultProject('Library', '', 'Ada');
    project.settings = { ...project.settings, traceabilityEnabled: undefined };
    const classDiagram = project.diagrams.ClassDiagram[0];
    classDiagram.model = {
      ...(classDiagram.model as object),
      elements: { c1: { id: 'c1', type: 'Class', name: 'Book', owner: null, bounds: { x: 0, y: 0, width: 1, height: 1 } } },
    } as unknown as typeof classDiagram.model;
    const envelope = buildProjectExportEnvelope(project, undefined, { includePersonalization: false });

    const imported = await importTemplateProject(asFile(envelope), MODEL_GENERATORS.template);
    expect(ProjectStorageRepository.loadProject(imported.id)?.settings.traceabilityEnabled).toBe(true);
    await flushTraceSaves();
    const trace = await loadProjectTrace(imported.id);
    const book = trace.artifacts.find((a) => isModelArtifact(a) && a.elementId === 'c1');
    expect(book).toMatchObject({ elementType: 'Class', name: 'Book' });
    // Written by the template library, not the user; the template's empty diagrams are not recorded.
    const tools = trace.operations.flatMap((o) => o.toolCalls.map((c) => trace.tools.find((t) => t.id === c.toolId)!.name));
    expect(new Set(tools)).toEqual(new Set([MODEL_GENERATORS.template]));
    expect(trace.artifacts.filter((a) => isModelArtifact(a) && a.parentId === undefined).map((a) => a.name)).toEqual([classDiagram.title]);
  });

  it('stores no trace when the project itself fails to import', async () => {
    vi.spyOn(ProjectStorageRepository, 'saveProject').mockImplementation(() => {
      throw new Error('storage full');
    });
    await expect(importProjectFromJson(asFile(envelopeWithTrace()))).rejects.toThrow();
    await new Promise((resolve) => setTimeout(resolve, SAVE_DELAY_MS + 100));
    await flushTraceSaves();
    expect(writes).toEqual([]);
  });
});
