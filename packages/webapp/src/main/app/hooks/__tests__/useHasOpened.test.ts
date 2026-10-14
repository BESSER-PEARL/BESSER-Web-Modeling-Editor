import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHasOpened } from '../useHasOpened';

describe('useHasOpened', () => {
  it('stays false until first open, then stays true after closing', () => {
    const { result, rerender } = renderHook(({ open }) => useHasOpened(open), { initialProps: { open: false } });
    expect(result.current).toBe(false);

    rerender({ open: true });
    expect(result.current).toBe(true);

    rerender({ open: false });
    expect(result.current).toBe(true);
  });

  it('is true immediately when initially open', () => {
    const { result } = renderHook(() => useHasOpened(true));
    expect(result.current).toBe(true);
  });
});
