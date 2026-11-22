import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import { createDefaultProject } from '../../../shared/types/project';
import type { BesserProject } from '../../../shared/types/project';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import { loadProjectTrace, replaceProjectTrace, setTraceStorage } from '../../../shared/traceability/traceStore';
import { memoryTraceStorage } from '../../../shared/traceability/traceDatabase';
import { emptyTraceFile, TRACE_SCHEMA_VERSION } from '../../../shared/types/traceability';
import type { TraceFile } from '../../../shared/types/traceability';
import { ApiError } from '../../../shared/api/api-client';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';

const conversion = vi.hoisted(() => ({ exportProjectAsBuml: vi.fn() }));
vi.mock('../../../shared/api/conversion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/conversion')>()),
  ...conversion,
}));
vi.mock('../../../shared/utils/download', () => ({ downloadFile: vi.fn() }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { exportProjectAsSingleBUMLFile } from '../useExportProjectBUML';

const t = '2026-11-01T10:00:00.000Z';

/** A project with a class diagram and a state machine, and a trace with one element of each. */
async function tracedProject(): Promise<{ project: BesserProject; trace: TraceFile }> {
  const project = createDefaultProject('Library', '', 'Ada');
  const cd = project.diagrams.ClassDiagram[0];
  const sm = project.diagrams.StateMachineDiagram[0];
  // Give both content, so the export keeps them.
  cd.model = { ...(cd.model as object), elements: { b: { id: 'b', type: 'Class', name: 'Book', owner: null } } } as never;
  sm.model = { ...(sm.model as object), elements: { s: { id: 's', type: 'State', name: 'Idle', owner: null } } } as never;
  const trace: TraceFile = {
    ...emptyTraceFile(project.id),
    artifacts: [
      { id: 'cd', type: 'ModelArtifact', name: 'Classes', elementId: cd.id, elementType: 'DomainModel', timestamp: t },
      { id: 'sm', type: 'ModelArtifact', name: 'States', elementId: sm.id, elementType: 'StateMachine', timestamp: t },
      { id: 'f', type: 'CodeArtifact', name: 'a', path: 'a', contentHash: 'h', revisionOfId: 'f0', timestamp: t },
    ],
  };
  await replaceProjectTrace(project.id, trace);
  return { project, trace: await loadProjectTrace(project.id) };
}

describe('exporting a project with its trace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setTraceStorage(memoryTraceStorage());
  });
  afterEach(() => vi.restoreAllMocks());

  it('bundles only the trace of the diagrams exported', async () => {
    const { project } = await tracedProject();
    const all = buildProjectExportEnvelope(project, undefined, { includeTrace: true });
    expect(all.trace!.artifacts.map((a) => a.id)).toEqual(['cd', 'sm', 'f']);
    const classesOnly = buildProjectExportEnvelope(project, ['ClassDiagram'], { includeTrace: true });
    expect(classesOnly.trace!.artifacts.map((a) => a.id)).toEqual(['cd']);
  });

  it('sends the trace again in the previous version when the backend refuses its version', async () => {
    const { project } = await tracedProject();
    vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(project);
    conversion.exportProjectAsBuml
      .mockRejectedValueOnce(new ApiError(400, 'Bad Request', `Unsupported trace schemaVersion ${TRACE_SCHEMA_VERSION}; expected one of [1, 2, 3, 4, 5].`))
      .mockResolvedValueOnce({ blob: new Blob(['# TRACEABILITY']), headers: new Headers() });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await exportProjectAsSingleBUMLFile(project, undefined, true)).toEqual({ ok: true });
    const retried = conversion.exportProjectAsBuml.mock.calls[1][0] as { trace: TraceFile };
    expect(retried.trace.schemaVersion).toBe(TRACE_SCHEMA_VERSION - 1);
    expect(retried.trace.artifacts[2]).not.toHaveProperty('revisionOfId');
    expect(toast.warn).not.toHaveBeenCalled();
  });

  it('tells the user when the backend left the trace out of the file', async () => {
    const { project } = await tracedProject();
    vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(project);
    conversion.exportProjectAsBuml.mockResolvedValueOnce({ blob: new Blob(['# no trace here']), headers: new Headers() });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await exportProjectAsSingleBUMLFile(project, undefined, true)).toEqual({ ok: true });
    expect(toast.warn).toHaveBeenCalledTimes(1);
  });

  it('shows the reason the backend gives when it left the trace out, once', async () => {
    const { project } = await tracedProject();
    vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(project);
    const reason = 'the file with the trace would be over 2 MiB';
    conversion.exportProjectAsBuml.mockResolvedValueOnce({
      blob: new Blob([`# BESSER: trace left out: ${reason}`]),
      headers: new Headers({ 'x-besser-warning': reason }),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await exportProjectAsSingleBUMLFile(project, undefined, true)).toEqual({ ok: true });
    expect(toast.warn).toHaveBeenCalledTimes(1);
    expect(toast.warn).toHaveBeenCalledWith(expect.stringContaining(reason));
  });

  it('shows the backend message when it refuses a trace that is too large', async () => {
    const { project } = await tracedProject();
    vi.spyOn(ProjectStorageRepository, 'loadProject').mockReturnValue(project);
    const message = 'The trace holds 250001 artifacts, more than the 250000 a trace may hold.';
    conversion.exportProjectAsBuml.mockRejectedValueOnce(new ApiError(400, 'Bad Request', message));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(await exportProjectAsSingleBUMLFile(project, undefined, true)).toMatchObject({ ok: false, reason: 'request' });
    expect(vi.mocked(toast.error).mock.calls.flat().join(' ')).toContain(message);
  });
});
