import { toast } from 'react-toastify';
import i18n from '../i18n';

/**
 * Approximate localStorage quota. Browsers count it in UTF-16 code units
 * (characters) of keys plus values; Chrome allows ~5.2M per origin.
 */
const QUOTA_LIMIT_CHARS = 5 * 1024 * 1024;

/** Warning threshold: 80% of the quota. */
export const LOCAL_STORAGE_WARNING_CHARS = Math.floor(QUOTA_LIMIT_CHARS * 0.8);

/** Debounce flag to avoid spamming warnings on rapid saves. */
let warningShownAt = 0;
const WARNING_COOLDOWN_MS = 60_000; // Only show warning once per minute

/** Characters used by all localStorage entries (keys plus values), the unit the quota is counted in. */
export function getLocalStorageUsageChars(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  }
  return total;
}

/** True for the error a storage write throws when the quota is exhausted. */
export function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22)
  );
}

/**
 * Check localStorage usage and show a warning toast if usage exceeds the
 * warning threshold (80% of the quota).  Safe to call frequently -- it
 * rate-limits the toast to at most once per minute.
 */
export function checkLocalStorageQuota(): void {
  try {
    const usage = getLocalStorageUsageChars();
    const now = Date.now();

    if (usage >= LOCAL_STORAGE_WARNING_CHARS && now - warningShownAt > WARNING_COOLDOWN_MS) {
      warningShownAt = now;
      toast.warning(
        i18n.t(
          'shared.storage.nearlyFull',
          'Browser storage is {{percent}}% full. Export your projects and delete the ones you no longer need to avoid losing changes.',
          { percent: Math.min(100, Math.round((usage / QUOTA_LIMIT_CHARS) * 100)) },
        ),
        { autoClose: 8000, toastId: 'localStorage-quota-warning' },
      );
    }
  } catch {
    // Silently ignore errors (e.g., in environments where localStorage is restricted)
  }
}
