import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importProjectFromJson } from '../projectImport';
import { ProjectStorageRepository } from '../../storage/ProjectStorageRepository';
import { buildProjectExportEnvelope } from '../../../utils/projectExportUtils';
import { createDefaultProject } from '../../../types/project';
import { flushTraceSaves, loadProjectTrace, SAVE_DELAY_MS, setTraceStorage } from '../../../traceability/traceStore';
import { memoryTraceStorage } from '../../../traceability/traceDatabase';
import type { TraceStorage } from '../../../traceability/traceDatabase';
import { emptyTraceFile } from '../../../types/traceability';

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
    const storage: TraceStorage = { ...inner, write: (id, trace) => { writes.push(id); return inner.write(id, trace); } };
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
