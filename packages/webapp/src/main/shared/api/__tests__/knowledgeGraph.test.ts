import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  post: vi.fn(),
  upload: vi.fn(),
  downloadFile: vi.fn(),
}));
vi.mock('../api-client', () => ({ apiClient: client, ApiError: class extends Error {} }));

import {
  analyzeKg,
  applyKgRefinement,
  checkKgConsistency,
  classifyOrphansWithLlm,
  exportKgRdf,
  filenameFromContentDisposition,
  importOwl,
  isKgLlmProvider,
  kgApiErrorMessage,
  kgToClassDiagram,
  llmCleanKg,
  type KgDiagramRef,
} from '../knowledgeGraph';

const diagram: KgDiagramRef = {
  id: 'd1',
  title: 'People',
  model: { type: 'KnowledgeGraphDiagram', version: '1.0.0', nodes: [], edges: [] },
};
const KEY = 'sk-test-secret-123';

beforeEach(() => {
  for (const fn of Object.values(client)) fn.mockReset().mockResolvedValue({});
});

/** The one FormData handed to `upload`, as a plain object. */
const uploadedForm = (): Record<string, string | File> => {
  const form = client.upload.mock.calls[0][1] as FormData;
  return Object.fromEntries(form.entries()) as Record<string, string | File>;
};

describe('JSON calls', () => {
  it('analyzeKg posts only the diagram', async () => {
    await analyzeKg(diagram);

    expect(client.post).toHaveBeenCalledWith('/analyze-kg-for-buml-conversion', {
      id: 'd1',
      title: 'People',
      model: diagram.model,
    });
  });

  it('checkKgConsistency posts only the diagram', async () => {
    await checkKgConsistency(diagram);

    expect(client.post).toHaveBeenCalledWith('/check-kg-consistency', { id: 'd1', title: 'People', model: diagram.model });
  });

  it('applyKgRefinement sends the source, signature and decisions', async () => {
    await applyKgRefinement({
      diagram,
      source: 'static',
      kgSignature: 'sig',
      resolutions: [{ issueId: 'i1', decision: 'accept' }],
    });

    const [endpoint, body] = client.post.mock.calls[0];
    expect(endpoint).toBe('/apply-kg-refinement');
    expect(body).toMatchObject({ id: 'd1', source: 'static', kgSignature: 'sig', resolutions: [{ issueId: 'i1', decision: 'accept' }] });
    expect(body).not.toHaveProperty('llmIssues');
  });

  it('applyKgRefinement sends the LLM issues back, since the backend keeps none', async () => {
    const issue = { id: 'i1', code: 'X', description: '', affectedNodeIds: [], affectedEdgeIds: [], recommendedAction: null, skipAction: null };

    await applyKgRefinement({ diagram, source: 'llm', kgSignature: 's', resolutions: [], llmIssues: [issue] });

    expect(client.post.mock.calls[0][1]).toMatchObject({ source: 'llm', llmIssues: [issue] });
  });

  it('kgToClassDiagram leaves out empty resolutions and a missing signature', async () => {
    await kgToClassDiagram({ diagram, resolutions: [] });

    const [endpoint, body, options] = client.post.mock.calls[0];
    expect(endpoint).toBe('/kg-to-class-diagram');
    expect(body).toEqual({ id: 'd1', title: 'People', model: diagram.model });
    expect(options.timeout).toBeGreaterThan(30_000);
  });

  it('kgToClassDiagram passes the decisions and signature when there are some', async () => {
    await kgToClassDiagram({ diagram, resolutions: [{ issueId: 'i', decision: 'skip' }], kgSignature: 'sig' });

    expect(client.post.mock.calls[0][1]).toMatchObject({ resolutions: [{ issueId: 'i', decision: 'skip' }], kgSignature: 'sig' });
  });
});

describe('LLM calls', () => {
  const credentials = { provider: 'anthropic', apiKey: KEY } as const;

  it('llmCleanKg posts JSON with the provider and key, never in the URL, and waits long enough', async () => {
    await llmCleanKg({ diagram, description: 'a library', credentials });

    const [endpoint, body, options] = client.post.mock.calls[0];
    expect(endpoint).toBe('/llm-clean-kg');
    expect(endpoint).not.toContain(KEY);
    expect(body).toEqual({
      diagram: { id: 'd1', title: 'People', model: diagram.model },
      description: 'a library',
      provider: 'anthropic',
      api_key: KEY,
    });
    // The backend lets its upstream call take 120 s; the browser must outlast that.
    expect(options.timeout).toBeGreaterThan(120_000);
  });

  it.each(['anthropic', 'openai', 'mistral', 'nebius'] as const)('sends the %s provider along with its key', async (provider) => {
    await llmCleanKg({ diagram, credentials: { provider, apiKey: KEY } });

    expect(client.post.mock.calls[0][1]).toMatchObject({ provider, api_key: KEY });
  });

  it('sends the model only when the user chose one, and a blank description not at all', async () => {
    await llmCleanKg({ diagram, description: '   ', credentials: { ...credentials, model: 'claude-haiku-4-5' } });
    await llmCleanKg({ diagram, credentials });

    const [chosen, defaulted] = client.post.mock.calls.map((c) => c[1]);
    expect(chosen).toMatchObject({ llm_model: 'claude-haiku-4-5' });
    expect(chosen).not.toHaveProperty('description');
    expect(defaulted).not.toHaveProperty('llm_model');
  });

  it('classifyOrphansWithLlm adds the node ids and the signature', async () => {
    await classifyOrphansWithLlm({
      diagram,
      description: 'a library',
      credentials,
      nodeIds: ['n1', 'n2'],
      kgSignature: 'sig',
    });

    const [endpoint, body, options] = client.post.mock.calls[0];
    expect(endpoint).toBe('/classify-orphans-with-llm');
    expect(endpoint).not.toContain(KEY);
    expect(body.node_ids).toEqual(['n1', 'n2']);
    expect(body.diagram.kgSignature).toBe('sig');
    expect(body).toMatchObject({ provider: 'anthropic', api_key: KEY, description: 'a library' });
    expect(options.timeout).toBeGreaterThan(120_000);
  });

  it('never puts the key anywhere except the api_key field', async () => {
    await llmCleanKg({ diagram, description: 'd', credentials });

    const [endpoint, body, options] = client.post.mock.calls[0];
    expect(JSON.stringify([endpoint, options])).not.toContain(KEY);
    const others: Record<string, unknown> = { ...body };
    delete others.api_key;
    expect(JSON.stringify(others)).not.toContain(KEY);
  });

  it('accepts exactly the providers the backend accepts a user key for', () => {
    for (const ok of ['anthropic', 'openai', 'mistral', 'nebius']) expect(isKgLlmProvider(ok)).toBe(true);
    // PIA and local need a custom base URL, which the server refuses to open.
    for (const no of ['pia', 'local', 'free', 'gemini']) expect(isKgLlmProvider(no)).toBe(false);
  });
});

describe('importOwl', () => {
  it('uploads the file as owl_file with room for a large ontology', async () => {
    const file = new File(['<rdf:RDF/>'], 'onto.owl');

    await importOwl(file);

    const [endpoint, , options] = client.upload.mock.calls[0];
    expect(endpoint).toBe('/import-owl');
    expect(uploadedForm().owl_file).toBeInstanceOf(File);
    expect((uploadedForm().owl_file as File).name).toBe('onto.owl');
    expect(options.timeout).toBeGreaterThan(30_000);
  });
});

describe('exportKgRdf', () => {
  it('posts the vocabulary choice to the format-specific endpoint and returns the server file name', async () => {
    const blob = new Blob(['x']);
    client.downloadFile.mockResolvedValue({
      blob,
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="people.ttl"' }),
    });

    const result = await exportKgRdf({ diagram, format: 'ttl', vocab: 'shacl' });

    expect(client.downloadFile).toHaveBeenCalledWith('/export-kg-rdf/ttl', {
      id: 'd1',
      title: 'People',
      model: diagram.model,
      vocab: 'shacl',
    });
    expect(result).toEqual({ blob, filename: 'people.ttl' });
  });

  it('reports no file name when the server sent none', async () => {
    client.downloadFile.mockResolvedValue({ blob: new Blob(['x']), headers: new Headers() });

    expect((await exportKgRdf({ diagram, format: 'owl', vocab: 'both' })).filename).toBeNull();
  });
});

describe('filenameFromContentDisposition', () => {
  it.each([
    ['attachment; filename="a b.ttl"', 'a b.ttl'],
    ['attachment; filename=plain.owl', 'plain.owl'],
    ['attachment; filename=plain.owl; size=3', 'plain.owl'],
    ['attachment', null],
    [null, null],
  ])('%s -> %s', (header, expected) => {
    expect(filenameFromContentDisposition(header)).toBe(expected);
  });
});

describe('kgApiErrorMessage', () => {
  const t = ((key: string) => `T(${key})`) as any;

  it('explains a timeout in the user language, not in milliseconds', () => {
    const timeout = new DOMException('Request timed out after 130000ms', 'TimeoutError');

    expect(kgApiErrorMessage(timeout, t, 'fallback')).toBe('T(import.kg.api.timedOut)');
  });

  it("shows the server's explanation", () => {
    expect(kgApiErrorMessage(new Error('The OpenAI request failed (HTTP 401).'), t, 'fallback')).toBe(
      'The OpenAI request failed (HTTP 401).',
    );
  });

  it("shows the message of a rejected thunk's serialized error", () => {
    // `.unwrap()` throws `{ name, message }`, not an Error instance.
    expect(kgApiErrorMessage({ name: 'Error', message: 'Failed to save project' }, t, 'fallback')).toBe(
      'Failed to save project',
    );
  });

  it('falls back when there is nothing to show', () => {
    expect(kgApiErrorMessage('boom', t, 'fallback')).toBe('fallback');
    expect(kgApiErrorMessage({ name: 'Error' }, t, 'fallback')).toBe('fallback');
    expect(kgApiErrorMessage(new Error(''), t, 'fallback')).toBe('fallback');
  });
});
