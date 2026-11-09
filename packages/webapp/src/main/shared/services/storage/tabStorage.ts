/**
 * Values scoped to this browser tab (sessionStorage) that come from the page
 * URL or the page lifecycle. The demo and study values throw like `Storage`
 * does: their callers validate them and decide what a failure means.
 */
import {
  sessionStorageChunkReloaded,
  sessionStorageDemoToken,
  sessionStoragePilotParticipant,
} from '../../constants/constant';

export const readDemoToken = (): string | null => window.sessionStorage.getItem(sessionStorageDemoToken);

export const writeDemoToken = (token: string): void => window.sessionStorage.setItem(sessionStorageDemoToken, token);

export const readPilotParticipant = (): string | null =>
  window.sessionStorage.getItem(sessionStoragePilotParticipant);

export const writePilotParticipant = (label: string): void =>
  window.sessionStorage.setItem(sessionStoragePilotParticipant, label);

/**
 * True when a stale lazy chunk may reload the page: once per tab, recorded
 * here. Without storage it is always true (once per page lifetime instead).
 */
export function claimChunkReload(): boolean {
  try {
    if (sessionStorage.getItem(sessionStorageChunkReloaded) === '1') return false;
    sessionStorage.setItem(sessionStorageChunkReloaded, '1');
  } catch {
    // private mode
  }
  return true;
}
