/**
 * The exact requests the shared/api modules send: URL, method, headers, body,
 * signal, timeout and keepalive. Calls through `apiClient` send its combined
 * (caller + timeout) signal; the raw-fetch exceptions send exactly what the
 * call sites sent before they moved here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_URL } from '../../constants/constant';
import {
  deployApp,
  generateFromDiagram,
  generateFromProject,
  personalizeGuiPage,
  recommendAgentConfigLlm,
  recommendAgentConfigMapping,
} from '../generation';
import {
  csvToDomainModel,
  exportBuml,
  exportProjectAsBuml,
  getJsonModel,
  getJsonModelFromImage,
  getJsonModelFromKg,
  getProjectJsonModel,
  getSdmxProviders,
  sdmxToDomainModel,
  transformAgentModelJson,
} from '../conversion';
import { postValidateDiagram } from '../validation';
import { submitFeedback } from '../feedback';
import { postTelemetryEvent } from '../telemetry';
import {
  cancelSpecDrivenRun,
  downloadSpecDrivenOutput,
  fetchSpecDrivenConfig,
  getSpecDrivenRunEventsPage,
  previewSpecDrivenRun,
} from '../specDriven';
import { checkRateLimit, resetRateLimit } from '../rateLimit';
import {
  deployToGitHub,
  fetchRawGitHubFile,
  getGitHubAuthStatus,
  getStarStatus,
  logOutOfGitHub,
  pushRunToGitHub,
  setStarred,
} from '../github';
import { getApiInfo } from '../apiInfo';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const lastCall = (): [string, RequestInit | undefined] => fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit | undefined];
const formEntries = (init: RequestInit | undefined) => [...(init?.body as FormData).entries()];

const JSON_ANY = { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' };
const JSON_ONLY = { 'Content-Type': 'application/json' };
const SIGNAL = expect.any(AbortSignal);
const DIAGRAM = { title: 'T', model: { type: 'ClassDiagram' } };

describe('generation', () => {
  it('posts one diagram to /generate-output', async () => {
    await generateFromDiagram({ ...DIAGRAM, generator: 'django' }, 300_000);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/generate-output`);
    expect(init).toEqual({
      method: 'POST',
      headers: JSON_ANY,
      body: JSON.stringify({ ...DIAGRAM, generator: 'django' }),
      signal: SIGNAL,
    });
  });

  it('posts a project to /generate-output-from-project', async () => {
    await generateFromProject({ id: 'p' }, 300_000);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/generate-output-from-project`);
    expect(init).toEqual({ method: 'POST', headers: JSON_ANY, body: '{"id":"p"}', signal: SIGNAL });
  });

  it('posts to /deploy-app', async () => {
    await deployApp(DIAGRAM);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/deploy-app`);
    expect(init).toEqual({ method: 'POST', headers: JSON_ANY, body: JSON.stringify(DIAGRAM), signal: SIGNAL });
  });
});

describe('conversion', () => {
  it('exports one diagram as B-UML, accepting a zip too', async () => {
    await exportBuml(DIAGRAM);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/export-buml`);
    expect(init).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, application/zip, */*' },
      body: JSON.stringify(DIAGRAM),
      signal: SIGNAL,
    });
  });

  it('exports a project as B-UML with only a JSON content type', async () => {
    await exportProjectAsBuml({ id: 'p' });
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/export-project-as-buml`);
    expect(init).toEqual({ method: 'POST', headers: JSON_ONLY, body: '{"id":"p"}', signal: SIGNAL });
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

  it('reads the SDMX providers and posts an SDMX import as JSON', async () => {
    await getSdmxProviders();
    expect(lastCall()).toEqual([`${BACKEND_URL}/sdmx-providers`, { method: 'GET', headers: JSON_ONLY, signal: SIGNAL }]);

    await sdmxToDomainModel({ provider: 'eurostat', dataflow: 'une_rt_m' });
    expect(lastCall()).toEqual([
      `${BACKEND_URL}/sdmx-to-domain-model`,
      { method: 'POST', headers: JSON_ONLY, body: '{"provider":"eurostat","dataflow":"une_rt_m"}', signal: SIGNAL },
    ]);
  });

  it('posts an agent model to /transform-agent-model-json', async () => {
    const body = { ...DIAGRAM, generator: 'agent', config: { language: 'fr' } };
    await transformAgentModelJson(body);
    expect(lastCall()).toEqual([
      `${BACKEND_URL}/transform-agent-model-json`,
      { method: 'POST', headers: JSON_ONLY, body: JSON.stringify(body), signal: SIGNAL },
    ]);
  });

  it('uploads a knowledge graph as kg_file with the key', async () => {
    await getJsonModelFromKg(new File(['k'], 'kg.ttl'), 'sk-test');
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/get-json-model-from-kg`);
    expect(formEntries(init).map(([name]) => name)).toEqual(['kg_file', 'api_key']);
  });
});

describe('agent configuration and GUI personalization', () => {
  const body = { userProfileName: 'Ana', userProfileModel: { elements: {} }, currentConfig: {} };

  it('posts both recommendations with the GitHub session header', async () => {
    await recommendAgentConfigMapping(body, 'sess');
    expect(lastCall()).toEqual([
      `${BACKEND_URL}/recommend-agent-config-mapping`,
      {
        method: 'POST',
        headers: { 'X-GitHub-Session': 'sess', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: SIGNAL,
      },
    ]);

    await recommendAgentConfigLlm({ ...body, model: 'gpt-5' }, 'sess');
    expect(lastCall()).toEqual([
      `${BACKEND_URL}/recommend-agent-config-llm`,
      {
        method: 'POST',
        headers: { 'X-GitHub-Session': 'sess', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, model: 'gpt-5' }),
        signal: SIGNAL,
      },
    ]);
  });

  it('posts a GUI page to /personalize-gui-page', async () => {
    const page = { guiPage: { components: [], css: [] }, pageName: 'Home', userProfileModel: { elements: {} } };
    await personalizeGuiPage(page);
    expect(lastCall()).toEqual([
      `${BACKEND_URL}/personalize-gui-page`,
      { method: 'POST', headers: JSON_ONLY, body: JSON.stringify(page), signal: SIGNAL },
    ]);
  });
});

describe('validation, feedback and telemetry', () => {
  it('posts the diagram to /validate-diagram', async () => {
    await postValidateDiagram(DIAGRAM);
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/validate-diagram`);
    expect(init).toEqual({ method: 'POST', headers: JSON_ONLY, body: JSON.stringify(DIAGRAM), signal: SIGNAL });
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
    expect(init).toEqual({ method: 'POST', headers: JSON_ONLY, body: JSON.stringify(submission), signal: SIGNAL });
  });

  it('posts a telemetry event with keepalive, so it outlives a page unload', async () => {
    await postTelemetryEvent({ session: 's1', participant: 'P1', kind: 'prompt', payload: { n: 1 } });
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/telemetry/event`);
    expect(init).toEqual({
      method: 'POST',
      headers: JSON_ONLY,
      body: '{"session":"s1","participant":"P1","kind":"prompt","payload":{"n":1}}',
      keepalive: true,
      signal: SIGNAL,
    });
  });
});

describe('spec-driven', () => {
  it('reads the config and downloads output with GETs', async () => {
    await fetchSpecDrivenConfig();
    expect(lastCall()).toEqual([`${BACKEND_URL}/spec-driven/config`, { method: 'GET', headers: JSON_ONLY, signal: SIGNAL }]);

    await downloadSpecDrivenOutput('abc');
    expect(lastCall()).toEqual([`${BACKEND_URL}/spec-driven/download/abc`, { method: 'GET', signal: SIGNAL }]);
  });

  it('posts a modify preview that the caller signal cancels', async () => {
    const caller = new AbortController();
    await previewSpecDrivenRun(
      { project: { id: 'p' }, instructions: 'add', mode: 'modify', base_run_id: 'r' },
      { signal: caller.signal, timeout: 8_000 },
    );
    const [url, init] = lastCall();
    expect(url).toBe(`${BACKEND_URL}/spec-driven/preview`);
    expect(init).toEqual({
      method: 'POST',
      headers: JSON_ONLY,
      body: '{"project":{"id":"p"},"instructions":"add","mode":"modify","base_run_id":"r"}',
      signal: SIGNAL,
    });
    caller.abort();
    expect(init?.signal?.aborted).toBe(true);
  });

  it('polls an events page as JSON with the caller signal (raw: the stream transport reads its failures)', async () => {
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

  it('resolves to whether the server accepted the cancel, never rejecting', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    await expect(cancelSpecDrivenRun('run1')).resolves.toBe(true);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(cancelSpecDrivenRun('run1')).resolves.toBe(false);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(cancelSpecDrivenRun('run1')).resolves.toBe(false);
  });
});

/** A fetch that never answers and rejects with its signal's abort reason. */
const hangingFetch = (_url: string, init: RequestInit) =>
  new Promise((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
  });

describe('timeouts', () => {
  const file = new File(['x'], 'f');
  const feedback = { satisfaction: 'happy' as const, category: 'bug', feedback: 'x', timestamp: 't', user_agent: 'u' };
  const preview = { project: {}, instructions: 'x', mode: 'modify' as const, base_run_id: 'r' };

  it.each<[string, number, () => Promise<unknown>]>([
    ['generate-output (caller-chosen)', 300_000, () => generateFromDiagram(DIAGRAM, 300_000)],
    ['generate-output-from-project (caller-chosen)', 600_000, () => generateFromProject({}, 600_000)],
    ['deploy-app', 1_800_000, () => deployApp(DIAGRAM)],
    ['export-buml', 120_000, () => exportBuml(DIAGRAM)],
    ['export-project-as-buml', 120_000, () => exportProjectAsBuml({})],
    ['get-json-model', 120_000, () => getJsonModel(file)],
    ['get-project-json-model', 120_000, () => getProjectJsonModel(file)],
    ['csv-to-domain-model', 120_000, () => csvToDomainModel([file])],
    ['get-json-model-from-image', 300_000, () => getJsonModelFromImage(file, 'k')],
    ['get-json-model-from-kg', 300_000, () => getJsonModelFromKg(file, 'k')],
    ['sdmx-providers', 30_000, () => getSdmxProviders()],
    ['sdmx-to-domain-model', 120_000, () => sdmxToDomainModel({ dataflow: 'x' })],
    ['transform-agent-model-json', 600_000, () => transformAgentModelJson(DIAGRAM)],
    ['recommend-agent-config-mapping', 30_000, () => recommendAgentConfigMapping({}, 's')],
    ['recommend-agent-config-llm', 30_000, () => recommendAgentConfigLlm({}, 's')],
    ['personalize-gui-page', 600_000, () => personalizeGuiPage({})],
    ['validate-diagram', 120_000, () => postValidateDiagram(DIAGRAM)],
    ['feedback', 60_000, () => submitFeedback(feedback)],
    ['telemetry/event', 30_000, () => postTelemetryEvent({ session: 's', participant: 'P', kind: 'prompt', payload: {} })],
    ['github/auth/logout', 30_000, () => logOutOfGitHub('s')],
    ['spec-driven/config', 30_000, () => fetchSpecDrivenConfig()],
    ['spec-driven/preview (caller-chosen)', 8_000, () => previewSpecDrivenRun(preview, { timeout: 8_000 })],
    ['spec-driven/download', 300_000, () => downloadSpecDrivenOutput('r')],
    ['github/deploy-webapp', 120_000, () => deployToGitHub('s', {})],
    ['spec-driven/push-to-github', 120_000, () => pushRunToGitHub('s', {} as Parameters<typeof pushRunToGitHub>[1])],
    ['api root (caller-chosen)', 3_000, () => getApiInfo(3_000)],
  ])('%s gives up after %i ms', async (_label, timeout, call) => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(hangingFetch);
    let settled: unknown = 'pending';
    void call().catch((error) => {
      settled = error;
    });
    await vi.advanceTimersByTimeAsync(timeout - 1);
    expect(settled).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toMatchObject({ name: 'TimeoutError' });
  });
});

describe('github deploy and push', () => {
  const SESSION_JSON = { 'X-GitHub-Session': 'sess', 'Content-Type': 'application/json' };

  it('posts the project with its deploy config to /github/deploy-webapp', async () => {
    const body = { name: 'shop', deploy_config: { repo_name: 'shop', use_existing: false }, projectExport: { version: 2 } };
    await deployToGitHub('sess', body);
    expect(lastCall()).toEqual([
      `${BACKEND_URL}/github/deploy-webapp`,
      { method: 'POST', headers: SESSION_JSON, body: JSON.stringify(body), signal: SIGNAL },
    ]);
  });

  it('posts a finished run to /spec-driven/push-to-github', async () => {
    const body = {
      run_id: 'r1',
      projectExport: { version: '2.0.0', type: 'project', project: {}, exportedAt: 't' },
      deploy_config: { repo_name: 'shop', is_private: true, use_existing: false, push_mode: 'commit' as const },
    } as unknown as Parameters<typeof pushRunToGitHub>[1];
    await pushRunToGitHub('sess', body);
    expect(lastCall()).toEqual([
      `${BACKEND_URL}/spec-driven/push-to-github`,
      { method: 'POST', headers: SESSION_JSON, body: JSON.stringify(body), signal: SIGNAL },
    ]);
  });
});

describe('api info', () => {
  it('gets the backend root with the caller-chosen timeout', async () => {
    await getApiInfo(3000);
    expect(lastCall()).toEqual([`${BACKEND_URL}/`, { method: 'GET', headers: JSON_ONLY, signal: SIGNAL }]);
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
      { method: 'POST', headers: JSON_ONLY, body: '{"session_id":"sess"}', signal: SIGNAL },
    ]);
  });

  it('fetches a raw GitHub file with a plain GET', async () => {
    await fetchRawGitHubFile('https://raw.githubusercontent.com/o/r/main/m.py');
    expect(fetchMock).toHaveBeenLastCalledWith('https://raw.githubusercontent.com/o/r/main/m.py');
  });
});
