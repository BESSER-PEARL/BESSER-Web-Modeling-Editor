/**
 * The BESSER Lab client against a faked `fetch`: what each call sends (route,
 * method, session header, body) and how it reads the answers of the HTTP contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, GITHUB_SESSION_REJECTED_EVENT } from '../api-client';
import { SseHttpError } from '../sseClient';
import {
  closeLabChange,
  createLabChange,
  createLabNote,
  deleteLabNote,
  dismissLabNoteProposal,
  dropLabChange,
  getLabAudit,
  getLabChange,
  getLabDiff,
  getLabHome,
  getLabMemory,
  getLabPreview,
  getLabPreviewLog,
  getLabReview,
  getLabSettings,
  labRefusal,
  listLabChanges,
  openLabPullRequests,
  refreshLabBases,
  restartLabPreview,
  startLabRun,
  takeLabPreviewSlot,
  touchLabPreviewSlot,
  updateLabChangeFromBase,
  updateLabNote,
  type LabDone,
  type LabNoteInput,
  type LabRefusalCode,
  type LabStreamEvent,
} from '../lab';

const SESSION = 'session-abcdef-123';
const CHANGE = '0123456789ab';
const encoder = new TextEncoder();

const DONE_LAB: LabDone = {
  step: 'build',
  changeId: CHANGE,
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
  report: null,
  pullRequests: [],
  cost: { usd: 0.42, turns: 12, elapsedSeconds: 90, runs: 1 },
  issues: [],
  finalText: 'Added the note element.',
  noteProposals: [],
};

const NOTE: LabNoteInput = {
  kind: 'convention',
  title: 'Registries',
  body: 'A new element is registered in four places.',
  repos: ['frontend'],
  changeKinds: ['editor_element'],
  docsTarget: 'CLAUDE.md',
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

const noContent = (): Response => new Response(null, { status: 204 });

const fetchMock = vi.fn();
const rejected = vi.fn();

const lastCall = (): { url: string; init: RequestInit & { headers: Record<string, string> } } => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url, init };
};

/** The route and query of the last request, without the backend's base URL. */
const lastRoute = (): string => {
  const url = new URL(lastCall().url, 'http://localhost');
  return url.pathname.replace(/^.*\/besser_api/, '') + url.search;
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
  it('posts the message to its change with the session header and yields the run events', async () => {
    const runId = 'a'.repeat(32);
    fetchMock.mockResolvedValue(
      sse([
        { event: 'start', runId },
        { event: 'phase', phase: 'build', message: 'Building' },
        { event: 'done', lab: DONE_LAB },
      ]),
    );

    const handle = startLabRun({
      message: 'Fix the failing check',
      action: 'build',
      project: { ClassDiagram: {} },
      githubSession: SESSION,
      changeId: CHANGE,
      review: { task: 'fix_ci', repo: 'frontend', commentIds: [] },
      issue: { repo: 'besser', number: 744 },
    });
    const events = await collect<LabStreamEvent>(handle.events);

    const { url, init } = lastCall();
    expect(url).toMatch(/\/besser_api\/lab\/message$/);
    expect(init.method).toBe('POST');
    expect(init.headers['X-GitHub-Session']).toBe(SESSION);
    expect(init.headers.Accept).toBe('text/event-stream');
    expect(JSON.parse(init.body as string)).toEqual({
      message: 'Fix the failing check',
      action: 'build',
      project: { ClassDiagram: {} },
      changeId: CHANGE,
      review: { task: 'fix_ci', repo: 'frontend', commentIds: [] },
      issue: { repo: 'besser', number: 744 },
    });
    expect(events.map((event) => event.event)).toEqual(['start', 'phase', 'done']);
    expect(events[2].lab).toEqual(DONE_LAB);
  });

  it('defaults to the auto action, no project, no review task and no issue', async () => {
    fetchMock.mockResolvedValue(sse([{ event: 'done', lab: DONE_LAB }]));

    await collect(startLabRun({ message: 'hi', githubSession: SESSION, changeId: CHANGE }).events);

    expect(JSON.parse(lastCall().init.body as string)).toEqual({
      message: 'hi',
      action: 'auto',
      project: null,
      changeId: CHANGE,
      review: null,
      issue: null,
    });
  });

  it('marks the GitHub session expired on a 401 and fails with the status', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Not signed in' }, 401));

    const error = await collect(startLabRun({ message: 'hi', githubSession: SESSION, changeId: CHANGE }).events).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(SseHttpError);
    expect((error as SseHttpError).status).toBe(401);
    expect(rejected).toHaveBeenCalledTimes(1);
  });

  it('keeps the session on a 403 (a login that is not on the list)', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Not allowed' }, 403));

    const error = await collect(startLabRun({ message: 'hi', githubSession: SESSION, changeId: CHANGE }).events).catch(
      (e) => e,
    );

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

    const handle = startLabRun({ message: 'hi', githubSession: SESSION, changeId: CHANGE });
    const first = await handle.events.next();
    expect(first.value).toMatchObject({ event: 'start' });

    handle.abort();

    expect(handle.controller.signal.aborted).toBe(true);
    expect((await handle.events.next()).done).toBe(true);
  });
});

describe('lab JSON routes', () => {
  const ANSWER = { answered: true };

  it.each<[string, () => Promise<unknown>, string, string, unknown]>([
    ['getLabHome', () => getLabHome(SESSION), 'GET', '/lab/home', undefined],
    ['listLabChanges', () => listLabChanges(SESSION), 'GET', '/lab/changes', undefined],
    ['createLabChange', () => createLabChange(SESSION), 'POST', '/lab/change', undefined],
    ['getLabChange', () => getLabChange(SESSION, CHANGE), 'GET', `/lab/change?changeId=${CHANGE}`, undefined],
    ['dropLabChange', () => dropLabChange(SESSION, CHANGE), 'POST', '/lab/change/drop', { changeId: CHANGE }],
    ['closeLabChange', () => closeLabChange(SESSION, CHANGE), 'POST', '/lab/change/close', { changeId: CHANGE }],
    [
      'updateLabChangeFromBase',
      () => updateLabChangeFromBase(SESSION, CHANGE, 'frontend'),
      'POST',
      '/lab/change/update-base',
      { changeId: CHANGE, repo: 'frontend' },
    ],
    [
      'openLabPullRequests',
      () => openLabPullRequests(SESSION, CHANGE),
      'POST',
      '/lab/pull-request',
      { changeId: CHANGE, title: null, body: null, closesIssues: [] },
    ],
    [
      'openLabPullRequests with a title, a body and the issues it closes',
      () =>
        openLabPullRequests(SESSION, CHANGE, {
          title: 'feat: note element',
          body: 'Adds it.',
          closesIssues: [{ repo: 'besser', number: 744 }],
        }),
      'POST',
      '/lab/pull-request',
      { changeId: CHANGE, title: 'feat: note element', body: 'Adds it.', closesIssues: [{ repo: 'besser', number: 744 }] },
    ],
    ['getLabDiff', () => getLabDiff(SESSION, CHANGE), 'GET', `/lab/diff?changeId=${CHANGE}`, undefined],
    [
      'getLabDiff of one file',
      () => getLabDiff(SESSION, CHANGE, { repo: 'besser', path: 'docs/a b.rst' }),
      'GET',
      `/lab/diff?changeId=${CHANGE}&repo=besser&path=docs%2Fa+b.rst`,
      undefined,
    ],
    ['getLabReview', () => getLabReview(SESSION, CHANGE), 'GET', `/lab/review?changeId=${CHANGE}`, undefined],
    ['getLabPreview', () => getLabPreview(SESSION), 'GET', '/lab/preview', undefined],
    ['takeLabPreviewSlot', () => takeLabPreviewSlot(SESSION, CHANGE), 'POST', '/lab/preview/slot', { changeId: CHANGE }],
    ['restartLabPreview of all services', () => restartLabPreview(SESSION, 1), 'POST', '/lab/preview/restart', { slot: 1, service: null }],
    [
      'restartLabPreview of one service',
      () => restartLabPreview(SESSION, 0, 'frontend'),
      'POST',
      '/lab/preview/restart',
      { slot: 0, service: 'frontend' },
    ],
    [
      'getLabPreviewLog',
      () => getLabPreviewLog(SESSION, 1, 'backend'),
      'GET',
      '/lab/preview/logs/backend?slot=1&lines=200',
      undefined,
    ],
    [
      'getLabPreviewLog with a line count',
      () => getLabPreviewLog(SESSION, 0, 'modeling_agent', 50),
      'GET',
      '/lab/preview/logs/modeling_agent?slot=0&lines=50',
      undefined,
    ],
    ['getLabSettings', () => getLabSettings(SESSION), 'GET', '/lab/settings', undefined],
    ['refreshLabBases', () => refreshLabBases(SESSION), 'POST', '/lab/settings/refresh-bases', undefined],
    ['getLabAudit', () => getLabAudit(SESSION), 'GET', '/lab/audit', undefined],
    ['getLabAudit of a month', () => getLabAudit(SESSION, '2026-10'), 'GET', '/lab/audit?month=2026-10', undefined],
    ['getLabMemory', () => getLabMemory(SESSION), 'GET', '/lab/memory', undefined],
    ['createLabNote', () => createLabNote(SESSION, NOTE), 'POST', '/lab/memory', NOTE],
    ['updateLabNote', () => updateLabNote(SESSION, 'n-1', NOTE), 'PUT', '/lab/memory/n-1', NOTE],
  ])('%s', async (_name, call, method, route, body) => {
    fetchMock.mockResolvedValue(json(ANSWER));

    await expect(call()).resolves.toEqual(ANSWER);

    const { init } = lastCall();
    expect(lastRoute()).toBe(route);
    expect(init.method).toBe(method);
    expect(init.headers['X-GitHub-Session']).toBe(SESSION);
    expect(init.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(body);
  });

  it.each<[string, () => Promise<void>, string, string, unknown]>([
    ['touchLabPreviewSlot', () => touchLabPreviewSlot(SESSION, 1), 'POST', '/lab/preview/slot/touch', { slot: 1 }],
    ['deleteLabNote', () => deleteLabNote(SESSION, 'n-1'), 'DELETE', '/lab/memory/n-1', undefined],
    [
      'dismissLabNoteProposal',
      () => dismissLabNoteProposal(SESSION, { changeId: CHANGE, id: 'p1' }),
      'POST',
      '/lab/memory/proposals/dismiss',
      { changeId: CHANGE, id: 'p1' },
    ],
  ])('%s resolves on the 204 it answers', async (_name, call, method, route, body) => {
    fetchMock.mockResolvedValue(noContent());

    await expect(call()).resolves.toBeUndefined();

    const { init } = lastCall();
    expect(lastRoute()).toBe(route);
    expect(init.method).toBe(method);
    expect(init.headers['X-GitHub-Session']).toBe(SESSION);
    expect(init.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(body);
  });

  it('a route that answers 204 still rejects with the refusal when the server refuses', async () => {
    fetchMock.mockResolvedValue(json({ detail: { code: 'not_found', message: 'No such note.' } }, 404));

    const error = await deleteLabNote(SESSION, 'n-404').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });

  it('a lab that is switched off answers 404, which rejects with that status', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Not Found' }, 404));

    const error = await getLabHome(SESSION).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect(rejected).not.toHaveBeenCalled();
  });

  it('a 401 on a JSON route marks the GitHub session expired', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Session expired' }, 401));

    await expect(listLabChanges(SESSION)).rejects.toBeInstanceOf(ApiError);

    expect(rejected).toHaveBeenCalledTimes(1);
  });
});

describe('labRefusal', () => {
  const refusedStream = (status: number, body: unknown) => new SseHttpError(status, JSON.stringify(body));

  it.each<[LabRefusalCode, number]>([
    ['change_busy', 409],
    ['runs_full', 429],
    ['user_cap', 409],
    ['instance_cap', 409],
    ['not_owner', 403],
    ['preview_full', 409],
    ['not_found', 404],
    ['state', 409],
  ])('reads the %s refusal', (code, status) => {
    const message = `The lab refused: ${code}.`;
    expect(labRefusal(refusedStream(status, { detail: { code, message } }))).toEqual({ code, message });
  });

  it('a plain string detail is unknown, with that text', () => {
    expect(labRefusal(refusedStream(403, { detail: 'Your login is not allowed.' }))).toEqual({
      code: 'unknown',
      message: 'Your login is not allowed.',
    });
    expect(labRefusal(new ApiError(401, 'Session expired', 'Session expired'))).toEqual({
      code: 'unknown',
      message: 'Session expired',
    });
  });

  it('a code the editor does not know is unknown, with the server message', () => {
    expect(labRefusal(refusedStream(409, { detail: { code: 'later_code', message: 'Something new.' } }))).toEqual({
      code: 'unknown',
      message: 'Something new.',
    });
  });

  it('any other shape is unknown, with the error text', () => {
    expect(labRefusal(new SseHttpError(502, '<html>Bad gateway</html>'))).toEqual({
      code: 'unknown',
      message: 'SSE request failed: 502',
    });
    expect(labRefusal(new TypeError('Failed to fetch'))).toEqual({ code: 'unknown', message: 'Failed to fetch' });
    expect(labRefusal('offline')).toEqual({ code: 'unknown', message: 'offline' });
  });
});

describe('LAB_BUILD', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is false in a default build', async () => {
    const { LAB_BUILD } = await import('../../constants/constant');
    expect(LAB_BUILD).toBe(false);
  });

  it.each([
    ['true', true],
    ['1', false],
    ['TRUE', false],
    ['', false],
  ])('LAB_BUILD=%j builds the lab: %s', async (value, expected) => {
    vi.stubEnv('LAB_BUILD', value);
    vi.resetModules();
    const { LAB_BUILD } = await import('../../constants/constant');
    expect(LAB_BUILD).toBe(expected);
  });
});
