import { toast } from 'react-toastify';

/** Approximate localStorage quota limit (5 MB). */
const QUOTA_LIMIT_BYTES = 5 * 1024 * 1024;

/** Warning threshold: 80% of 5 MB = 4 MB. */
const WARNING_THRESHOLD_BYTES = 4 * 1024 * 1024;

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
 * Check localStorage usage and show a warning toast if usage exceeds the
 * warning threshold (4 MB out of 5 MB).  Safe to call frequently -- it
 * rate-limits the toast to at most once per minute.
 */
export function checkLocalStorageQuota(): void {
  try {
    const usageBytes = getLocalStorageUsageBytes();
    const now = Date.now();

    if (usageBytes >= WARNING_THRESHOLD_BYTES && now - warningShownAt > WARNING_COOLDOWN_MS) {
      warningShownAt = now;
      const usageMB = (usageBytes / (1024 * 1024)).toFixed(1);
      const limitMB = (QUOTA_LIMIT_BYTES / (1024 * 1024)).toFixed(0);
      toast.warning(
        `Local storage is nearly full (${usageMB} MB / ${limitMB} MB). ` +
        `Consider exporting your projects and clearing old data to avoid data loss.`,
        { autoClose: 8000, toastId: 'localStorage-quota-warning' },
      );
    }
  } catch {
    // Silently ignore errors (e.g., in environments where localStorage is restricted)
  }
}
