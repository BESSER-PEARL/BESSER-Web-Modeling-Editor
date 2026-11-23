/**
 * A project that records traces sends EVERY generation through the traced endpoints, single-diagram ones and
 * project ones alike, and falls back to the plain endpoint (keeping the download) when the traced one fails.
 */
import { act, renderHook } from '@testing-library/react';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGenerateCode } from '../useGenerateCode';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../../shared/types/project';
import type { BesserProject } from '../../../../shared/types/project';
import { emptyTraceFile } from '../../../../shared/types/traceability';
import type { GenerationOptions, GenerationResult } from '../../types';

/** A project that records traces: recording is opt-in. */
const recordingProject = (...args: Parameters<typeof createDefaultProject>) => {
  const project = createDefaultProject(...args);
  project.settings.traceabilityEnabled = true;
  return project;
};

const trace = vi.hoisted(() => ({ recordGenerationTrace: vi.fn((_projectId: string, _fragment: unknown) => true) }));
vi.mock('../../../../shared/traceability/traceStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/traceability/traceStore')>()),
  ...trace,
}));
const traced = vi.hoisted(() => ({ toastTraced: vi.fn() }));
vi.mock('../../../traceability', () => traced);
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn() } }));
const download = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => download }));
vi.mock('../../../../shared/services/githubStarPrompt', () => ({ promptForGitHubStarOnce: vi.fn() }));

const MODEL = { version: '3.0.0', type: 'ClassDiagram', elements: {}, relationships: {} };

let project: BesserProject;

const tracedResponse = () =>
  new Response(JSON.stringify({
    fileName: 'classes.py', mediaType: 'text/x-python', contentBase64: btoa('class Book: pass'),
    trace: { ...emptyTraceFile('x'), projectId: null },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const plainResponse = () =>
  new Response('class Book: pass', { status: 200, headers: { 'Content-Disposition': 'attachment; filename="classes.py"' } });

const urls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map(([url]) => String(url).replace(/^.*besser_api/, ''));
const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, call: number) => JSON.parse(String((fetchMock.mock.calls[call][1] as RequestInit).body));

async function generate(generator: string, opts?: GenerationOptions): Promise<GenerationResult> {
  const { result } = renderHook(() => useGenerateCode());
  let outcome: GenerationResult | undefined;
  await act(async () => {
    outcome = await result.current(null, generator, 'Library', undefined, undefined, MODEL as never, opts);
  });
  return outcome!;
}

describe('traced generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    project = recordingProject('Library', '', 'Ada');
    vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockImplementation(() => project);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('traces any single-diagram generator, naming the diagram the model was read from', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tracedResponse());
    vi.stubGlobal('fetch', fetchMock);
    const outcome = await generate('python', { traceDiagramId: 'stored-class-diagram' });
    expect(outcome).toEqual({ ok: true, filename: 'classes.py' });
    expect(urls(fetchMock)).toEqual(['/traceability/generate-output']);
    expect(bodyOf(fetchMock, 0)).toMatchObject({ id: 'stored-class-diagram', generator: 'python', actorName: 'Ada', title: 'Library' });
    expect(trace.recordGenerationTrace).toHaveBeenCalledWith(project.id, expect.objectContaining({ projectId: project.id }));
    expect(traced.toastTraced).toHaveBeenCalledWith(expect.any(String), { tab: 'lineage', root: 'stored-class-diagram' });
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('defaults to the open diagram of the project', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tracedResponse());
    vi.stubGlobal('fetch', fetchMock);
    await generate('jsonschema');
    expect(bodyOf(fetchMock, 0).id).toBe(project.diagrams.ClassDiagram[0].id);
  });

  it('traces a project generator through the project endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(tracedResponse());
    vi.stubGlobal('fetch', fetchMock);
    const outcome = await generate('web_app');
    expect(outcome.ok).toBe(true);
    expect(urls(fetchMock)).toEqual(['/traceability/generate-output-from-project']);
    expect(bodyOf(fetchMock, 0)).toMatchObject({ actorName: 'Ada', settings: expect.objectContaining({ generator: 'web_app' }) });
  });

  it('falls back to the plain endpoint when the traced one fails, and says the trace was not recorded', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Not Found' }), { status: 404 }))
      .mockResolvedValueOnce(plainResponse());
    vi.stubGlobal('fetch', fetchMock);
    const outcome = await generate('java', { autoDownload: false });
    expect(outcome).toMatchObject({ ok: true, filename: 'classes.py', blob: expect.anything() });
    expect(urls(fetchMock)).toEqual(['/traceability/generate-output', '/generate-output']);
    expect(trace.recordGenerationTrace).not.toHaveBeenCalled();
    expect(toast.warn).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  // The 400 texts are BESSER's traced_generation.py verbatim, the last 422 its handler's body as sent:
  // TRACE_ONLY_REFUSAL matches their wording, so a change of it on either side must break here.
  it.each<[number, unknown]>([
    [405, 'Method Not Allowed'],
    [501, 'Not Implemented'],
    [400, 'A traced generation needs the diagram id: the trace refers to the model by it.'],
    [400, 'A traced generation needs the id of every diagram it reads: the trace refers to each model by it. Without an id: GUI.'],
    [422, 'actorName: String should have at most 200 characters'],
    [422, [{ type: 'string_too_long', loc: ['body', 'actorName'], msg: 'String should have at most 200 characters' }]],
  ])('falls back on %s %j, which only the traced endpoint answers', async (status, detail) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail }), { status }))
      .mockResolvedValueOnce(plainResponse());
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const outcome = await generate('python');
    expect(outcome).toMatchObject({ ok: true });
    expect(urls(fetchMock)).toEqual(['/traceability/generate-output', '/generate-output']);
  });

  it.each([
    [400, 'The model has no classes'],
    [500, 'Generation failed: template error'],
    [500, 'Internal server error'],
    [429, 'Too many requests'],
  ])('does not generate twice on %s %s: the generation failed, not the trace', async (status, detail) => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ detail }), { status }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const outcome = await generate('sql');
    expect(outcome).toMatchObject({ ok: false });
    expect(urls(fetchMock)).toEqual(['/traceability/generate-output']);
    expect(toast.warn).not.toHaveBeenCalled();
  });

  it('cuts an owner name to what the traced endpoint accepts', async () => {
    project = { ...project, owner: 'A'.repeat(250) };
    const fetchMock = vi.fn().mockResolvedValue(tracedResponse());
    vi.stubGlobal('fetch', fetchMock);
    await generate('python');
    expect(bodyOf(fetchMock, 0).actorName).toHaveLength(200);
  });

  it('uses the plain endpoint alone when the project does not record traces', async () => {
    project = { ...project, settings: { ...project.settings, traceabilityEnabled: false } };
    const fetchMock = vi.fn().mockResolvedValue(plainResponse());
    vi.stubGlobal('fetch', fetchMock);
    await generate('django');
    expect(urls(fetchMock)).toEqual(['/generate-output']);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(traced.toastTraced).not.toHaveBeenCalled();
  });
});
