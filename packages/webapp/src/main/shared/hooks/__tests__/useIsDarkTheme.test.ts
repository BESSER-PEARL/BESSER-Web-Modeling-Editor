/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useIsDarkTheme } from '../useIsDarkTheme';

afterEach(() => {
  document.documentElement.classList.remove('dark');
  document.documentElement.removeAttribute('data-theme');
});

describe('useIsDarkTheme', () => {
  it('reads the theme the page is in when it mounts', () => {
    document.documentElement.classList.add('dark');

    expect(renderHook(() => useIsDarkTheme()).result.current).toBe(true);
  });

  it('is false in the light theme', () => {
    expect(renderHook(() => useIsDarkTheme()).result.current).toBe(false);
  });

  it('follows the theme being switched, in both directions', async () => {
    const { result } = renderHook(() => useIsDarkTheme());

    await act(async () => {
      document.documentElement.classList.add('dark');
      await Promise.resolve();
    });
    expect(result.current).toBe(true);

    await act(async () => {
      document.documentElement.classList.remove('dark');
      await Promise.resolve();
    });
    expect(result.current).toBe(false);
  });

  it('stops listening when unmounted', async () => {
    const { result, unmount } = renderHook(() => useIsDarkTheme());
    unmount();

    await act(async () => {
      document.documentElement.classList.add('dark');
      await Promise.resolve();
    });

    expect(result.current).toBe(false);
  });
});
