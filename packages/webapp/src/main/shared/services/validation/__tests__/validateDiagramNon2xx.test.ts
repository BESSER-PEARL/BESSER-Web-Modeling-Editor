import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-toastify', () => {
  const toast: any = vi.fn();
  for (const k of ['success', 'error', 'warning', 'info', 'loading', 'dismiss']) toast[k] = vi.fn();
  return { toast };
});

import { validateDiagram } from '../validateDiagram';

const model = {
  version: '4.0.0',
  type: 'ClassDiagram',
  nodes: [{ id: 'a', type: 'class', position: { x: 0, y: 0 }, data: { name: 'A' } }],
  edges: [],
  _suppressToasts: true,
};

// The backend reports model errors with a 200; a non-2xx means the check itself
// failed, and the assistant's auto-repair must not ask the agent to fix it.
describe('validateDiagram on a non-2xx response', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a proxy 502 with an HTML body is a failed check', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      }),
    );
    const result: any = await validateDiagram(null, 'P', { ...model });
    expect(result.checkFailed).toBe(true);
  });

  it('a 422 request error is a failed check', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ detail: [{ msg: 'field required' }] }) }),
    );
    const result: any = await validateDiagram(null, 'P', { ...model });
    expect(result.checkFailed).toBe(true);
  });
});
