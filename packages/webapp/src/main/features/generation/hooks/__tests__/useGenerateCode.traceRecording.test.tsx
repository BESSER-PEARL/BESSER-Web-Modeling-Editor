/**
 * Recording a generation's trace never costs the user the generation: the file is delivered first, and a trace
 * fragment that cannot be recorded is left out with a warning, against the real trace store.
 */
import { act, renderHook } from '@testing-library/react';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGenerateCode } from '../useGenerateCode';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../../shared/types/project';
import { emptyTraceFile } from '../../../../shared/types/traceability';
import { flushTraceSaves, getProjectTrace, loadProjectTrace, setTraceStorage } from '../../../../shared/traceability/traceStore';
import { memoryTraceStorage } from '../../../../shared/traceability/traceDatabase';
import type { GenerationResult } from '../../types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const download = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => download }));
vi.mock('../../../../shared/services/githubStarPrompt', () => ({ promptForGitHubStarOnce: vi.fn() }));
vi.mock('../../../traceability', () => ({ toastTraced: vi.fn() }));

const MODEL = { version: '3.0.0', type: 'ClassDiagram', elements: {}, relationships: {} };

const responseWith = (trace: unknown) =>
  new Response(JSON.stringify({ fileName: 'classes.py', mediaType: 'text/x-python', contentBase64: btoa('class Book: pass'), trace }),
    { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('a generation whose trace cannot be recorded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTraceStorage(memoryTraceStorage());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ['loaded', true],
    ['not loaded yet', false],
  ])('still downloads the file when the trace is %s', async (_label, preload) => {
    const project = createDefaultProject('Library', '', 'Ada');
    vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockReturnValue(project);
    if (preload) await loadProjectTrace(project.id);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    // A schema-valid fragment whose operation lacks its lists.
    const fetchMock = vi.fn().mockResolvedValue(responseWith({
      ...emptyTraceFile('x'), projectId: null, operations: [{ id: 'o', type: 'CodeGeneration', status: 'SUCCEEDED' }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGenerateCode());
    let outcome: GenerationResult | undefined;
    await act(async () => {
      outcome = await result.current(null, 'python', 'Library', undefined, undefined, MODEL as never);
    });
    await loadProjectTrace(project.id);
    await flushTraceSaves();
    process.off('unhandledRejection', unhandled);
    expect(outcome).toEqual({ ok: true, filename: 'classes.py' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // not generated a second time
    expect(download).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
    // Nothing half-merged: the broken operation is not in the trace.
    expect(getProjectTrace(project.id)!.operations.some((o) => !Array.isArray(o.toolCalls))).toBe(false);
  });

  it('warns that the trace was not recorded when the fragment is not a trace', async () => {
    const project = createDefaultProject('Library', '', 'Ada');
    vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockReturnValue(project);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWith({ schemaVersion: 6, artifacts: 'nope' })));
    const { result } = renderHook(() => useGenerateCode());
    let outcome: GenerationResult | undefined;
    await act(async () => {
      outcome = await result.current(null, 'python', 'Library', undefined, undefined, MODEL as never);
    });
    expect(outcome).toEqual({ ok: true, filename: 'classes.py' });
    expect(download).toHaveBeenCalledTimes(1);
    expect(toast.warn).toHaveBeenCalled();
  });
});
