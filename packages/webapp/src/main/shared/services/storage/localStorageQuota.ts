/** Approximate localStorage quota limit (5 MB). */
export const QUOTA_LIMIT_BYTES = 5 * 1024 * 1024;

/** Warning threshold: 80% of 5 MB = 4 MB. */
const WARNING_THRESHOLD_BYTES = 4 * 1024 * 1024;

/**
 * Fired on `window` when localStorage is nearly full. The app shell shows the
 * warning (with its "free up space" action), so this module stays free of UI.
 */
export const STORAGE_QUOTA_WARNING_EVENT = 'besser:storage-quota-warning';

export interface StorageQuotaWarningDetail {
  usageBytes: number;
  limitBytes: number;
}

/** Debounce flag to avoid spamming warnings on rapid saves. */
let warningShownAt = 0;
const WARNING_COOLDOWN_MS = 60_000; // Only show warning once per minute

/**
 * Calculate the approximate number of bytes used by all localStorage entries.
 * JavaScript strings are UTF-16, so each character takes ~2 bytes.
 */
export function getLocalStorageUsageBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  }
  return total * 2; // UTF-16 encoding = 2 bytes per char
}

/**
 * Check localStorage usage and announce `STORAGE_QUOTA_WARNING_EVENT` if usage
 * exceeds the warning threshold (4 MB out of 5 MB).  Safe to call frequently --
 * it rate-limits the warning to at most once per minute.
 */
export function checkLocalStorageQuota(): void {
  try {
    const usageBytes = getLocalStorageUsageBytes();
    const now = Date.now();

    if (usageBytes >= WARNING_THRESHOLD_BYTES && now - warningShownAt > WARNING_COOLDOWN_MS) {
      warningShownAt = now;
      const detail: StorageQuotaWarningDetail = { usageBytes, limitBytes: QUOTA_LIMIT_BYTES };
      window.dispatchEvent(new CustomEvent(STORAGE_QUOTA_WARNING_EVENT, { detail }));
    }
  } catch {
    // Silently ignore errors (e.g., in environments where localStorage is restricted)
  }
}
