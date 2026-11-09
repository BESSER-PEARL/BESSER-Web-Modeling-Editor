/**
 * An empty diagram is reported valid (nothing is wrong with it) but was never
 * checked; `empty` says so, so the quality-check pass rate does not count it.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), loading: vi.fn(), update: vi.fn(), dismiss: vi.fn(), error: vi.fn() } }));

import { validateDiagram } from '../validateDiagram';

describe('validateDiagram on an empty diagram', () => {
  it('reports it valid and marks it empty, without calling the backend', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await validateDiagram(null, 'Diagram', { type: 'ClassDiagram', elements: {}, relationships: {} } as any);
    expect(result).toMatchObject({ isValid: true, errors: [], empty: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
