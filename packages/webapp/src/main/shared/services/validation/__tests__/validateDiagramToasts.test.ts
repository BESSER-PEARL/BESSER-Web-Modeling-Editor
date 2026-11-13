import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => {
  const fn: any = vi.fn();
  for (const k of ['success', 'error', 'warning', 'info', 'loading', 'dismiss']) fn[k] = vi.fn();
  return fn;
});
vi.mock('react-toastify', () => ({ toast: toastMock }));

import { validateDiagram } from '../validateDiagram';

// Live report: "Valid constraints" toasts used autoClose:false with a hard-coded
// dark theme, and each run raised up to three separate toasts, so they piled up.
const model = {
  version: '4.0.0',
  type: 'ClassDiagram',
  nodes: [{ id: 'n1', type: 'class', position: { x: 0, y: 0 }, data: { name: 'A' } }],
  edges: [],
};

const shownToasts = () =>
  (['success', 'error', 'warning', 'info'] as const).flatMap((kind) =>
    toastMock[kind].mock.calls.map((call: any[]) => ({ kind, message: call[0], options: call[1] ?? {} })),
  );

describe('validateDiagram result toasts', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.values(toastMock).forEach((f: any) => f.mockClear?.());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const run = async (result: Record<string, unknown>) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => result })),
    );
    await validateDiagram(null, 'D', { ...model });
  };

  it('merges errors, warnings and constraint results into one auto-closing, app-themed toast', async () => {
    await run({
      isValid: false,
      errors: [],
      warnings: ['w1'],
      valid_constraints: ['c1', 'c2'],
      invalid_constraints: ['c3'],
    });
    const toasts = shownToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].kind).toBe('error');
    expect(toasts[0].message).toContain('c1');
    expect(toasts[0].message).toContain('c3');
    expect(toasts[0].message).toContain('w1');
    expect(typeof toasts[0].options.autoClose).toBe('number');
    expect(toasts[0].options.theme).toBeUndefined();
  });

  it('a fully valid run with valid constraints shows one success toast that auto-closes', async () => {
    await run({ isValid: true, errors: [], warnings: [], valid_constraints: ['c1'], invalid_constraints: [] });
    const toasts = shownToasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].kind).toBe('success');
    expect(toasts[0].options.autoClose).toBeGreaterThan(0);
  });

  it('replaces the previous run\'s result toast instead of stacking', async () => {
    await run({ isValid: true, valid_constraints: ['c1'] });
    const firstId = shownToasts()[0].options.toastId;
    await run({ isValid: true, valid_constraints: ['c1'] });
    expect(firstId).toBeTruthy();
    expect(toastMock.dismiss).toHaveBeenCalledWith(firstId);
  });

  it('never hard-codes the dark theme on the loading toast', async () => {
    await run({ isValid: true });
    expect(toastMock.loading).toHaveBeenCalled();
    expect(toastMock.loading.mock.calls[0][1].theme).toBeUndefined();
  });
});
