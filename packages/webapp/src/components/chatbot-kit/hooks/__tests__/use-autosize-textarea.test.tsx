/**
 * The composer must shrink back after a long message is sent.
 *
 * Observed live 2026-09-16: pasting a 4608-character prompt and sending it
 * left an EMPTY textarea still 1284px tall, even though the hook is called
 * with maxHeight 240. Two defects combined —
 *
 *   1. `originalHeight` was measured from whatever content was present on the
 *      first render, so a box that mounted holding a long value recorded that
 *      as its minimum;
 *   2. the minimum was applied AFTER the maxHeight clamp, so it could exceed
 *      the ceiling outright.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAutosizeTextArea } from '../use-autosize-textarea';

const MAX = 240;
const EMPTY_HEIGHT = 40;

/**
 * A textarea whose scrollHeight tracks its value, the way a real one does:
 * tall while it holds a long string, back to one row when cleared.
 */
function makeTextArea(initialValue: string): HTMLTextAreaElement {
  const el = { value: initialValue, style: {} as Record<string, unknown> } as unknown as HTMLTextAreaElement;
  el.style.removeProperty = vi.fn(() => '') as unknown as CSSStyleDeclaration['removeProperty'];
  Object.defineProperty(el, 'scrollHeight', {
    get() {
      return el.value.length > 0 ? 1284 : EMPTY_HEIGHT;
    },
  });
  return el;
}

function heightOf(el: HTMLTextAreaElement): number {
  return parseInt(String(el.style.height ?? '0'), 10);
}

describe('useAutosizeTextArea', () => {
  it('shrinks back to the empty height after a long value is cleared', () => {
    const el = makeTextArea('x'.repeat(4608));
    const ref = { current: el };

    const { rerender } = renderHook(
      ({ value }) =>
        useAutosizeTextArea({ ref, maxHeight: MAX, borderWidth: 1, dependencies: [value] }),
      { initialProps: { value: el.value } },
    );

    // Long value: capped at maxHeight, never the raw 1284.
    expect(heightOf(el)).toBeLessThanOrEqual(MAX + 2);

    // Sending clears the box.
    el.value = '';
    rerender({ value: '' });

    expect(heightOf(el)).toBeLessThanOrEqual(EMPTY_HEIGHT + 2);
  });

  it('never exceeds maxHeight, whatever it mounted with', () => {
    const el = makeTextArea('y'.repeat(9000));
    const ref = { current: el };
    renderHook(() =>
      useAutosizeTextArea({ ref, maxHeight: MAX, borderWidth: 1, dependencies: [el.value] }),
    );
    expect(heightOf(el)).toBeLessThanOrEqual(MAX + 2);
  });

  it('grows for a long value from an empty start', () => {
    const el = makeTextArea('');
    const ref = { current: el };
    const { rerender } = renderHook(
      ({ value }) =>
        useAutosizeTextArea({ ref, maxHeight: MAX, borderWidth: 1, dependencies: [value] }),
      { initialProps: { value: '' } },
    );
    expect(heightOf(el)).toBeLessThanOrEqual(EMPTY_HEIGHT + 2);

    el.value = 'z'.repeat(4608);
    rerender({ value: el.value });
    expect(heightOf(el)).toBe(MAX + 2);
  });
});
