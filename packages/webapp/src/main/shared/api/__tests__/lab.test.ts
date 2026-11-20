/**
 * The BESSER Lab client against a faked `fetch`: what each call sends (route,
 * method, session header, body) and how it reads the answers of the HTTP contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, GITHUB_SESSION_REJECTED_EVENT } from '../api-client';
import { SseHttpError } from '../sseClient';
import {
  dropLabChange,
  getLabState,
  openLabPullRequests,
  parkLabChange,
  resetLabPreview,
  resumeLabChange,
  startLabRun,
  type LabDone,
  type LabState,
  type LabStreamEvent,
} from '../lab';

const SESSION = 'session-abcdef-123';
const encoder = new TextEncoder();

const DONE_LAB: LabDone = {
  step: 'build',
  changeId: 'c1',
  title: 'Note element',
  kind: 'editor_element',
  plan: null,
  modelProposal: null,
  repoChanges: [
    { repo: 'frontend', branch: 'lab/jordi/note-element', base: 'develop', files: [{ path: 'packages/x.ts', status: 'added' }] },
  ],
  checks: [
    { id: 'frontend:lint', repo: 'frontend', title: 'Lint', passed: true, skipped: false, summary: 'ok', durationSeconds: 3.1 },
  ],
  checklist: [{ id: 'element.registries', text: 'Registered in the four registries', done: null }],
  summary: 'Added the note element.',
  stopReason: 'completed',
  finalText: 'Added the note element.',
};

const STATE: LabState = {
  enabled: true,
  user: 'jordi',
  change: null,
  parked: [{ changeId: 'c0', title: 'Old', kind: 'generator', createdAt: 1_763_000_000 }],
  preview: { enabled: true, services: [{ name: 'backend', running: true, detail: 'pid 12' }] },
  run: null,
};

const sse = (events: unknown[]): Response =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fetchMock = vi.fn();
const rejected = vi.fn();

const lastCall = (): { url: string; init: RequestInit & { headers: Record<string, string> } } => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url, init };
};

async function collect<T>(events: AsyncGenerator<T, void, void>): Promise<T[]> {
  const out: T[] = [];
  for await (const event of events) out.push(event);
  return out;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  window.addEventListener(GITHUB_SESSION_REJECTED_EVENT, rejected);
});

afterEach(() => {
  window.removeEventListener(GITHUB_SESSION_REJECTED_EVENT, rejected);
  rejected.mockReset();
  vi.unstubAllGlobals();
});

describe('startLabRun', () => {
  it('posts the message with the session header and yields the run events', async () => {
    const runId = 'a'.repeat(32);
    fetchMock.mockResolvedValue(
      sse([
        { event: 'start', runId },
        { event: 'phase', phase: 'build', message: 'Building' },
        { event: 'done', lab: DONE_LAB },
      ]),
    );

    const handle = startLabRun({
      message: 'Add a note element',
      action: 'build',
      project: { ClassDiagram: {} },
      githubSession: SESSION,
    });
    const events = await collect<LabStreamEvent>(handle.events);

    const { url, init } = lastCall();
    expect(url).toMatch(/\/besser_api\/lab\/message$/);
    expect(init.method).toBe('POST');
    expect(init.headers['X-GitHub-Session']).toBe(SESSION);
    expect(init.headers.Accept).toBe('text/event-stream');
    expect(JSON.parse(init.body as string)).toEqual({
      message: 'Add a note element',
      action: 'build',
      project: { ClassDiagram: {} },
    });
    expect(events.map((event) => event.event)).toEqual(['start', 'phase', 'done']);
    expect(events[2].lab).toEqual(DONE_LAB);
  });

  it('defaults to the auto action and no project', async () => {
    fetchMock.mockResolvedValue(sse([{ event: 'done', lab: DONE_LAB }]));

    await collect(startLabRun({ message: 'hi', githubSession: SESSION }).events);

    expect(JSON.parse(lastCall().init.body as string)).toEqual({ message: 'hi', action: 'auto', project: null });
  });

  it('marks the GitHub session expired on a 401 and fails with the status', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Not signed in' }, 401));

    const error = await collect(startLabRun({ message: 'hi', githubSession: SESSION }).events).catch((e) => e);

    expect(error).toBeInstanceOf(SseHttpError);
    expect((error as SseHttpError).status).toBe(401);
    expect(rejected).toHaveBeenCalledTimes(1);
  });

  it('keeps the session on a 403 (a login that is not on the list)', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Not allowed' }, 403));

    const error = await collect(startLabRun({ message: 'hi', githubSession: SESSION }).events).catch((e) => e);

    expect((error as SseHttpError).status).toBe(403);
    expect(rejected).not.toHaveBeenCalled();
  });

  it('abort stops the request the run is streamed on', async () => {
    // A stream that never closes: only the abort can end it.
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'start', runId: 'b'.repeat(32) })}\n\n`));
          },
        }),
        { status: 200 },
      ),
    );

    const handle = startLabRun({ message: 'hi', githubSession: SESSION });
    const first = await handle.events.next();
    expect(first.value).toMatchObject({ event: 'start' });

    handle.abort();

    expect(handle.controller.signal.aborted).toBe(true);
    expect((await handle.events.next()).done).toBe(true);
  });
});

describe('lab JSON routes', () => {
  it('getLabState reads the state with the session header', async () => {
    fetchMock.mockResolvedValue(json(STATE));

    await expect(getLabState(SESSION)).resolves.toEqual(STATE);

    const { url, init } = lastCall();
    expect(url).toMatch(/\/besser_api\/lab\/state$/);
    expect(init.method).toBe('GET');
    expect(init.headers['X-GitHub-Session']).toBe(SESSION);
  });

  it('a lab that is switched off answers 404, which rejects with that status', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Not Found' }, 404));

    const error = await getLabState(SESSION).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect(rejected).not.toHaveBeenCalled();
  });

  it('a 401 on a JSON route marks the GitHub session expired', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Session expired' }, 401));

    await expect(parkLabChange(SESSION)).rejects.toBeInstanceOf(ApiError);

    expect(rejected).toHaveBeenCalledTimes(1);
  });

  const ACTIVE = { ...STATE, change: { ...DONE_LAB, plan: undefined, modelProposal: undefined } };

  it('openLabPullRequests sends the change id, null title and body by default and returns the pull requests with the checks note', async () => {
    const opened = {
      pullRequests: [
        { repo: 'frontend', number: 7, url: 'https://github.com/o/wme/pull/7', branch: 'lab/jordi/x', base: 'develop' },
      ],
      checksNote: 'The quick checks passed; the full suites run in CI.',
    };
    fetchMock.mockResolvedValueOnce(json(ACTIVE)).mockResolvedValueOnce(json(opened));

    await expect(openLabPullRequests(SESSION, 'c1')).resolves.toEqual(opened);

    const { url, init } = lastCall();
    expect(url).toMatch(/\/besser_api\/lab\/pull-request$/);
    expect(init.method).toBe('POST');
    expect(init.headers['X-GitHub-Session']).toBe(SESSION);
    expect(JSON.parse(init.body as string)).toEqual({ changeId: 'c1', title: null, body: null });
  });

  it('openLabPullRequests passes a chosen title and body', async () => {
    fetchMock.mockResolvedValueOnce(json(ACTIVE)).mockResolvedValueOnce(json({ pullRequests: [], checksNote: '' }));

    await openLabPullRequests(SESSION, 'c1', { title: 'feat: note element', body: 'Adds it.' });

    expect(JSON.parse(lastCall().init.body as string)).toEqual({
      changeId: 'c1',
      title: 'feat: note element',
      body: 'Adds it.',
    });
  });

  it.each([
    ['another change is active', ACTIVE],
    ['no change is active', STATE],
  ])('openLabPullRequests pushes nothing and resolves null when %s', async (_name, state) => {
    fetchMock.mockResolvedValue(json(state));

    await expect(openLabPullRequests(SESSION, 'c-older-card')).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastCall().url).toMatch(/\/besser_api\/lab\/state$/);
  });

  it.each([
    ['park', () => parkLabChange(SESSION), '/lab/change/park', {}],
    ['resume', () => resumeLabChange(SESSION, 'c0'), '/lab/change/resume', { changeId: 'c0' }],
    ['drop', () => dropLabChange(SESSION), '/lab/change/drop', {}],
    ['preview reset', () => resetLabPreview(SESSION), '/lab/preview/reset', {}],
  ])('%s posts to its route and returns the new state', async (_name, call, path, body) => {
    fetchMock.mockResolvedValue(json(STATE));

    await expect(call()).resolves.toEqual(STATE);

    const { url, init } = lastCall();
    expect(url.endsWith(`/besser_api${path}`)).toBe(true);
    expect(init.method).toBe('POST');
    expect(init.headers['X-GitHub-Session']).toBe(SESSION);
    expect(JSON.parse(init.body as string)).toEqual(body);
  });
});
