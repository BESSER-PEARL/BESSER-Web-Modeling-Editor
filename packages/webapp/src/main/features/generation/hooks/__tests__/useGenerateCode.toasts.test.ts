import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const toastMock = vi.hoisted(() => {
  const fn: any = vi.fn();
  for (const k of ['success', 'error', 'warning', 'info', 'loading', 'dismiss']) fn[k] = vi.fn();
  return fn;
});
vi.mock('react-toastify', () => ({ toast: toastMock }));
vi.mock('../../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => vi.fn() }));

import { useGenerateCode } from '../useGenerateCode';

const model = {
  version: '4.0.0',
  type: 'ClassDiagram',
  nodes: [{ id: 'n1', type: 'class', position: { x: 0, y: 0 }, data: { name: 'A' } }],
  edges: [],
};

const stubBackend = (validation: Record<string, unknown>) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      String(url).endsWith('/validate-diagram')
        ? { ok: true, json: async () => validation }
        : new Response('code', { headers: { 'Content-Disposition': 'attachment; filename="classes.py"' } }),
    ),
  );

const generate = async () => {
  const { result } = renderHook(() => useGenerateCode());
  return result.current({ model } as any, 'python', 'Library');
};

// Live report: every Generate raised a validation toast ("✅ Diagram is valid",
// check icon and emoji, backend English) on top of the success toast.
describe('Generate toasts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.values(toastMock).forEach((f: any) => f.mockClear?.());
  });

  it('shows only the success toast when validation passes', async () => {
    stubBackend({ isValid: true, message: '✅ Diagram is valid', errors: [], warnings: [] });
    expect((await generate()).ok).toBe(true);
    expect(toastMock.success).toHaveBeenCalledTimes(1);
    expect(toastMock.success.mock.calls[0][0]).not.toContain('Diagram is valid');
    expect(toastMock.info).not.toHaveBeenCalled();
  });

  it('still reports validation warnings', async () => {
    stubBackend({ isValid: true, errors: [], warnings: ['Class A has no attributes'] });
    await generate();
    expect(toastMock.warning).toHaveBeenCalledWith(expect.stringContaining('Class A has no attributes'), expect.anything());
  });
});
