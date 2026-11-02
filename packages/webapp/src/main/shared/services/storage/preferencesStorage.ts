/**
 * Per-browser preferences in localStorage: the default interface, the one-time
 * GitHub star prompt and the analytics consent. Best effort: never throws.
 */
import {
  localStorageAnalyticsConsent,
  localStorageGitHubStarPrompted,
  localStoragePreferredInterface,
} from '../../constants/constant';
import type { InterfaceMode } from '../../types/project';

/** The interface saved with "Remember my choice", or null. */
export function readPreferredInterface(): InterfaceMode | null {
  try {
    const value = localStorage.getItem(localStoragePreferredInterface);
    return value === 'model' || value === 'agent' ? value : null;
  } catch {
    return null;
  }
}

/** Save the default interface, or forget it with null. */
export function writePreferredInterface(mode: InterfaceMode | null): void {
  try {
    if (mode) {
      localStorage.setItem(localStoragePreferredInterface, mode);
    } else {
      localStorage.removeItem(localStoragePreferredInterface);
    }
  } catch {
    // private mode or quota: non-fatal
  }
}

/** Record that the star prompt must not appear again. */
export function markGitHubStarPrompted(): void {
  try {
    localStorage.setItem(localStorageGitHubStarPrompted, 'true');
  } catch {
    // nothing to remember
  }
}

/**
 * True the first time in this browser, and records it before returning, so a
 * storage that rejects the write never shows the prompt.
 */
export function claimGitHubStarPrompt(): boolean {
  try {
    if (localStorage.getItem(localStorageGitHubStarPrompted)) return false;
    localStorage.setItem(localStorageGitHubStarPrompted, 'true');
    return true;
  } catch {
    return false;
  }
}

export interface StoredAnalyticsConsent {
  status: 'pending' | 'accepted' | 'declined';
  timestamp: string;
  version: string;
}

/** The stored consent record, or null when none or unreadable. */
export function readAnalyticsConsent(): StoredAnalyticsConsent | null {
  try {
    const stored = localStorage.getItem(localStorageAnalyticsConsent);
    return stored ? (JSON.parse(stored) as StoredAnalyticsConsent) : null;
  } catch {
    return null;
  }
}

/** Returns false when the record could not be stored. */
export function writeAnalyticsConsent(consent: StoredAnalyticsConsent): boolean {
  try {
    localStorage.setItem(localStorageAnalyticsConsent, JSON.stringify(consent));
    return true;
  } catch {
    return false;
  }
}
