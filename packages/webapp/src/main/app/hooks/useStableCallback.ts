import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Returns a callback with a stable identity that always invokes the latest `fn`.
 * For handlers passed to memoized children that read fast-changing state (the
 * active diagram changes on every autosave). Not for use during render.
 */
export function useStableCallback<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R {
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });
  return useCallback((...args: Args) => fnRef.current(...args), []);
}
