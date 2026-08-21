import { useEffect } from 'react';

/**
 * Listens for the browser `storage` event, which fires when localStorage
 * is modified in a *different* tab/window of the same origin.
 *
 * This enables cross-tab synchronization of shared state such as
 * project data, theme preferences, or any other localStorage-backed value.
 *
 * Note: The `storage` event does NOT fire in the tab that made the change —
 * it only fires in other tabs. Same-tab sync is handled by other mechanisms
 * (e.g. ProjectStorageRepository change listeners).
 *
 * @param key       The localStorage key to watch.
 * @param onExternalChange  Called with the new value (or null if removed)
 *                          whenever another tab modifies this key.
 */
export function useCrossTabSync(
  key: string,
  onExternalChange: (newValue: string | null) => void,
): void {
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key) {
        onExternalChange(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, onExternalChange]);
}
