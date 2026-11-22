import { useCallback, useState } from 'react';

/** A copy of `set` with `id` added, or removed when it was there. */
export function toggledIn<T>(set: ReadonlySet<T>, id: T): Set<T> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** A set in state with a stable `toggle(id)`: what is open, collapsed or expanded in a view. */
export function useToggleSet<T = string>(initial: () => Set<T> = () => new Set<T>()) {
  const [set, setSet] = useState<Set<T>>(initial);
  const toggle = useCallback((id: T) => setSet((previous) => toggledIn(previous, id)), []);
  return [set, toggle, setSet] as const;
}
