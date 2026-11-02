/**
 * What the browser keeps for GitHub: the tab's sign-in (session id in
 * sessionStorage, username in localStorage) and the intents that survive the
 * OAuth redirect. The sign-in functions throw like `Storage` does (githubAuth
 * decides); the intent functions are best effort and never throw.
 */
import {
  localStorageGitHubUsername,
  sessionStorageContinueFromGithubIntent,
  sessionStorageGitHubSession,
  sessionStorageGitHubSessionExpired,
  sessionStorageGitHubSessionTimestamp,
  sessionStorageSpecDrivenPushIntent,
} from '../../constants/constant';

/* ---- Sign-in ---- */

export const readGitHubSession = (): string | null => sessionStorage.getItem(sessionStorageGitHubSession);

/** Epoch ms the stored session was received, 0 when unknown. */
export const readGitHubSessionTimestamp = (): number =>
  parseInt(sessionStorage.getItem(sessionStorageGitHubSessionTimestamp) || '0', 10);

/** Store a new session for this tab; it is no longer "expired". */
export function writeGitHubSession(session: string): void {
  sessionStorage.setItem(sessionStorageGitHubSession, session);
  sessionStorage.setItem(sessionStorageGitHubSessionTimestamp, String(Date.now()));
  sessionStorage.removeItem(sessionStorageGitHubSessionExpired);
}

export function clearGitHubSession(): void {
  sessionStorage.removeItem(sessionStorageGitHubSession);
  sessionStorage.removeItem(sessionStorageGitHubSessionTimestamp);
}

/** Drop the session and remember, for this tab, that it expired. */
export function expireGitHubSession(): void {
  clearGitHubSession();
  sessionStorage.setItem(sessionStorageGitHubSessionExpired, '1');
}

export const isGitHubSessionExpired = (): boolean => !!sessionStorage.getItem(sessionStorageGitHubSessionExpired);

export const readGitHubUsername = (): string | null => localStorage.getItem(localStorageGitHubUsername);

export const writeGitHubUsername = (username: string): void =>
  localStorage.setItem(localStorageGitHubUsername, username);

/** Sign-out: forget the session, the expired mark and the username. */
export function forgetGitHubSignIn(): void {
  clearGitHubSession();
  sessionStorage.removeItem(sessionStorageGitHubSessionExpired);
  localStorage.removeItem(localStorageGitHubUsername);
}

/* ---- "Continue from GitHub" (Project Hub) intent ---- */

/** The stored intent: '1' for the repo picker, or a JSON resume point. */
export function readContinueFromGithubIntent(): string | null {
  try {
    return sessionStorage.getItem(sessionStorageContinueFromGithubIntent);
  } catch {
    return null;
  }
}

export function writeContinueFromGithubIntent(value = '1'): void {
  try {
    sessionStorage.setItem(sessionStorageContinueFromGithubIntent, value);
  } catch {
    // sign-in still proceeds; the hub opens at its default step
  }
}

export function clearContinueFromGithubIntent(): void {
  try {
    sessionStorage.removeItem(sessionStorageContinueFromGithubIntent);
  } catch {
    // ignore
  }
}

/* ---- Spec-Driven "Push to GitHub" intent ---- */

export interface SpecDrivenPushIntent {
  runId?: string;
  projectId?: string;
}

export function writeSpecDrivenPushIntent(intent: { runId: string; projectId: string }): void {
  try {
    sessionStorage.setItem(sessionStorageSpecDrivenPushIntent, JSON.stringify(intent));
  } catch {
    // the login still proceeds
  }
}

/** The stored intent, or null when none, unreadable or not JSON. */
export function readSpecDrivenPushIntent(): SpecDrivenPushIntent | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(sessionStorageSpecDrivenPushIntent);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSpecDrivenPushIntent(): void {
  try {
    sessionStorage.removeItem(sessionStorageSpecDrivenPushIntent);
  } catch {
    // ignore
  }
}
