/**
 * The exact requests the shared/api modules send: URL, method, headers, body,
 * signal and keepalive, as the call sites sent them before they moved here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_URL } from '../../constants/constant';
import { deployApp, generateFromDiagram, generateFromProject } from '../generation';
import {
  csvToDomainModel,
  exportBuml,
  exportProjectAsBuml,
  getJsonModel,
  getJsonModelFromImage,
  getJsonModelFromKg,
  getProjectJsonModel,
} from '../conversion';
import { postValidateDiagram } from '../validation';
import { submitFeedback } from '../feedback';
import { postTelemetryEvent } from '../telemetry';
import {
  cancelSpecDrivenRun,
  downloadSpecDrivenOutput,
  getSpecDrivenConfigResponse,
  getSpecDrivenRunEventsPage,
  previewSpecDrivenRun,
} from '../specDriven';
import { checkRateLimit, resetRateLimit } from '../rateLimit';
import { fetchRawGitHubFile, getGitHubAuthStatus, getStarStatus, logOutOfGitHub, setStarred } from '../github';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const lastCall = (): [string, RequestInit | undefined] => fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit | undefined];
const formEntries = (init: RequestInit | undefined) => [...(init?.body as FormData).entries()];

const JSON_ANY = { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' };

describe('generation', () => {
  it('posts one diagram to /generate-output with the caller signal', async () => {
    const signal = new AbortController().signal;
    await generateFromDiagram({ title: 'T', generator: 'django' }, signal);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/generate-output`);
    expect(init).toEqual({
      method: 'POST',
      headers: JSON_ANY,
      body: JSON.stringify({ title: 'T', generator: 'django' }),
      signal,
    });
  });

  it('posts a project to /generate-output-from-project', async () => {
    const signal = new AbortController().signal;
    await generateFromProject({ id: 'p' }, signal);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/generate-output-from-project`);
    expect(init).toMatchObject({ method: 'POST', headers: JSON_ANY, body: '{"id":"p"}', signal });
  });

  it('posts to /deploy-app without a signal', async () => {
    await deployApp({ title: 'T' });
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/deploy-app`);
    expect(init).toMatchObject({ method: 'POST', headers: JSON_ANY, body: '{"title":"T"}' });
    expect(init?.signal).toBeUndefined();
  });
});

describe('conversion', () => {
  it('exports one diagram as B-UML, accepting a zip too', async () => {
    await exportBuml({ title: 'T' });
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/export-buml`);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, application/zip, */*' },
      body: '{"title":"T"}',
    });
  });

  it('exports a project as B-UML with only a JSON content type', async () => {
    await exportProjectAsBuml({ id: 'p' });
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/export-project-as-buml`);
    expect(init).toEqual({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"id":"p"}' });
  });

  it('uploads a B-UML file as buml_file to /get-json-model and /get-project-json-model', async () => {
    const file = new File(['x'], 'm.py');
    await getJsonModel(file);
    expect(lastCall()[0]).toBe(`${BACKEND_URL}/get-json-model`);
    expect(lastCall()[1]?.method).toBe('POST');
    expect(lastCall()[1]?.headers).toBeUndefined();
    expect(formEntries(lastCall()[1])).toEqual([['buml_file', expect.any(File)]]);

    await getProjectJsonModel(file);
    expect(lastCall()[0]).toBe(`${BACKEND_URL}/get-project-json-model`);
    expect(formEntries(lastCall()[1]).map(([name]) => name)).toEqual(['buml_file']);
  });

  it('uploads every spreadsheet as files', async () => {
    await csvToDomainModel([new File(['a'], 'a.csv'), new File(['b'], 'b.csv')]);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/csv-to-domain-model`);
    expect(formEntries(init).map(([name, value]) => [name, (value as File).name])).toEqual([
      ['files', 'a.csv'],
      ['files', 'b.csv'],
    ]);
  });

  it('sends the image, the key and, only when given, the model to merge into', async () => {
    const image = new File(['i'], 'd.png');
    await getJsonModelFromImage(image, 'sk-test');
    expect(lastCall()[0]).toBe(`${BACKEND_URL}/get-json-model-from-image`);
    expect(formEntries(lastCall()[1]).map(([name]) => name)).toEqual(['image_file', 'api_key']);

    await getJsonModelFromImage(image, 'sk-test', { title: 'Shop', model: { elements: { a: 1 } } });
    const entries = formEntries(lastCall()[1]);
    expect(entries.map(([name]) => name)).toEqual(['image_file', 'api_key', 'existing_model']);
    expect(entries[1][1]).toBe('sk-test');
    expect(entries[2][1]).toBe('{"title":"Shop","model":{"elements":{"a":1}}}');
  });

  it('uploads a knowledge graph as kg_file with the key', async () => {
    await getJsonModelFromKg(new File(['k'], 'kg.ttl'), 'sk-test');
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/get-json-model-from-kg`);
    expect(formEntries(init).map(([name]) => name)).toEqual(['kg_file', 'api_key']);
  });
});

describe('validation, feedback and telemetry', () => {
  it('posts the diagram to /validate-diagram with the caller signal', async () => {
    const signal = new AbortController().signal;
    await postValidateDiagram({ title: 'T', model: { type: 'ClassDiagram' } }, signal);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/validate-diagram`);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"title":"T","model":{"type":"ClassDiagram"}}',
      signal,
    });
  });

  it('posts the feedback form to /feedback', async () => {
    const submission = {
      satisfaction: 'happy' as const,
      category: 'bug',
      feedback: 'Works',
      email: null,
      timestamp: '2026-01-01T00:00:00.000Z',
      user_agent: 'test',
    };
    await submitFeedback(submission);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/feedback`);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
  });

  it('posts a telemetry event with keepalive', async () => {
    await postTelemetryEvent({ session: 's1', participant: 'P1', kind: 'prompt', payload: { n: 1 } });
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/telemetry/event`);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"session":"s1","participant":"P1","kind":"prompt","payload":{"n":1}}',
      keepalive: true,
    });
  });
});

describe('spec-driven', () => {
  it('reads the config and downloads output with plain GETs', async () => {
    await getSpecDrivenConfigResponse();
    expect(fetchMock).toHaveBeenLastCalledWith(`${BACKEND_URL}/spec-driven/config`);

    await downloadSpecDrivenOutput('abc');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BACKEND_URL}/spec-driven/download/abc`);
  });

  it('posts a modify preview', async () => {
    const signal = new AbortController().signal;
    await previewSpecDrivenRun({ project: { id: 'p' }, instructions: 'add', mode: 'modify', base_run_id: 'r' }, signal);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/spec-driven/preview`);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"project":{"id":"p"},"instructions":"add","mode":"modify","base_run_id":"r"}',
      signal,
    });
  });

  it('polls an events page as JSON', async () => {
    const signal = new AbortController().signal;
    await getSpecDrivenRunEventsPage('run1', 7, signal);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/spec-driven/runs/run1/events.json?after=7&limit=250`);
    expect(init).toEqual({ signal, headers: { Accept: 'application/json' } });
  });

  it('cancels with a keepalive POST, or a beacon on unload', () => {
    cancelSpecDrivenRun('run1');
    expect(fetchMock).toHaveBeenLastCalledWith(`${BACKEND_URL}/spec-driven/cancel/run1`, {
      method: 'POST',
      keepalive: true,
    });

    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
    try {
      fetchMock.mockClear();
      cancelSpecDrivenRun('run1', { beacon: true });
      expect(sendBeacon).toHaveBeenCalledWith(`${BACKEND_URL}/spec-driven/cancel/run1`);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      delete (navigator as { sendBeacon?: unknown }).sendBeacon;
    }
  });

  it('never throws when the cancel request fails', () => {
    fetchMock.mockImplementation(() => {
      throw new TypeError('offline');
    });
    expect(() => cancelSpecDrivenRun('run1')).not.toThrow();
  });
});

describe('rate limiter (editor server)', () => {
  it('checks and resets on the given endpoint with same-origin credentials', async () => {
    await checkRateLimit('/api/uml-agent/rate-limit/check', 42);
    expect(lastCall()).toEqual([
      '/api/uml-agent/rate-limit/check',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: '{"messageLength":42}',
      },
    ]);

    await resetRateLimit('/api/uml-agent/rate-limit/check');
    expect(lastCall()).toEqual(['/api/uml-agent/rate-limit/check', { method: 'DELETE', credentials: 'same-origin' }]);
  });
});

describe('github sign-in and star', () => {
  it('checks the session and the star with the session header', async () => {
    const signal = new AbortController().signal;
    await getGitHubAuthStatus('sess', signal);
    expect(lastCall()).toEqual([`${BACKEND_URL}/github/auth/status`, { headers: { 'X-GitHub-Session': 'sess' }, signal }]);

    await getStarStatus('sess', signal);
    expect(lastCall()).toEqual([`${BACKEND_URL}/github/star/status`, { headers: { 'X-GitHub-Session': 'sess' }, signal }]);
  });

  it('stars with PUT and unstars with DELETE', async () => {
    await setStarred('sess', true);
    expect(lastCall()).toEqual([`${BACKEND_URL}/github/star`, { method: 'PUT', headers: { 'X-GitHub-Session': 'sess' } }]);
    await setStarred('sess', false);
    expect(lastCall()).toEqual([`${BACKEND_URL}/github/star`, { method: 'DELETE', headers: { 'X-GitHub-Session': 'sess' } }]);
  });

  it('logs out by session id in the body', async () => {
    await logOutOfGitHub('sess');
    expect(lastCall()).toEqual([
      `${BACKEND_URL}/github/auth/logout`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"session_id":"sess"}' },
    ]);
  });

  it('fetches a raw GitHub file with a plain GET', async () => {
    await fetchRawGitHubFile('https://raw.githubusercontent.com/o/r/main/m.py');
    expect(fetchMock).toHaveBeenLastCalledWith('https://raw.githubusercontent.com/o/r/main/m.py');
  });
});
