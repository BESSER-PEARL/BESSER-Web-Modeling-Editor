/**
 * The tab's GitHub sign-in, one store for the whole app.
 *
 * Every component that needs GitHub reads this store (through
 * `useGitHubAuth`), so signing in, signing out and a session the backend
 * rejects reach all of them at once. The session id lives in
 * `sessionStorage` (tab-scoped, never in a URL the server logs); the
 * username in `localStorage`.
 *
 * Status:
 * - `checking`: a stored session is being verified; do not start a sign-in yet.
 * - `signed-in`: the session works.
 * - `expired`: the backend rejected the session (401) or it is over a day old;
 *   the username is kept so the UI can offer "Reconnect".
 * - `signed-out`.
 */
import { toast } from 'react-toastify';
import i18n from '../../i18n';
import { BACKEND_URL } from '../../constants/constant';
import { GITHUB_SESSION_REJECTED_EVENT } from '../../api/api-client';

export type GitHubAuthStatus = 'checking' | 'signed-in' | 'expired' | 'signed-out';

export interface GitHubAuthState {
  status: GitHubAuthStatus;
  username: string | null;
  session: string | null;
  /** True between starting the OAuth redirect and leaving the page. */
  redirecting: boolean;
}

const SESSION_KEY = 'github_session';
const SESSION_TIMESTAMP_KEY = 'github_session_timestamp';
const USERNAME_KEY = 'github_username';
// The backend keeps sessions in memory for a day.
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const VERIFY_TIMEOUT_MS = 30_000;

const isValidSessionToken = (token: string) => /^[a-zA-Z0-9_-]{10,200}$/.test(token);
const isValidGitHubUsername = (name: string) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(name);

const SIGNED_OUT: GitHubAuthState = { status: 'signed-out', username: null, session: null, redirecting: false };

let state: GitHubAuthState = SIGNED_OUT;
let started = false;
const listeners = new Set<() => void>();

const setState = (next: Partial<GitHubAuthState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const clearStoredSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_TIMESTAMP_KEY);
};

export const getGitHubAuthState = (): GitHubAuthState => state;

/** The session id for `X-GitHub-Session`, or null when not signed in. */
export const getGitHubSession = (): string | null => (state.status === 'signed-in' ? state.session : null);

export function subscribeGitHubAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The session the backend or GitHub refused: keep the username, ask to reconnect. */
export function markGitHubSessionExpired(): void {
  if (state.status !== 'signed-in' && state.status !== 'checking') return;
  clearStoredSession();
  setState({ status: 'expired', session: null });
}

async function verifySession(session: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetch(`${BACKEND_URL}/github/auth/status`, {
      headers: { 'X-GitHub-Session': session },
      signal: controller.signal,
    });
    const data: { success?: boolean; username?: string } = await response.json();
    if (state.session !== session) return; // signed out or in again meanwhile
    if (data.success && data.username) {
      localStorage.setItem(USERNAME_KEY, data.username);
      setState({ status: 'signed-in', username: data.username });
    } else {
      markGitHubSessionExpired();
    }
  } catch (error) {
    // The backend could not answer (e.g. restarting during a deploy): keep the
    // session; a GitHub call that gets a 401 marks it expired.
    console.warn('Could not verify the GitHub session; keeping it:', error);
    if (state.session === session) setState({ status: 'signed-in' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the sign-in once per page: the OAuth callback's URL fragment, else the
 * stored session (verified with the backend). Later calls do nothing.
 */
export function startGitHubAuth(): void {
  if (started) return;
  started = true;
  window.addEventListener(GITHUB_SESSION_REJECTED_EVENT, markGitHubSessionExpired);

  // The callback puts the session in the fragment (never sent to a server or
  // logged by a proxy); an error comes back as a query parameter.
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const sessionFromUrl = fragment.get('github_session');
  const usernameFromUrl = fragment.get('username');
  const error = query.get('error');
  const cleanUrl = () => window.history.replaceState({}, document.title, window.location.pathname);

  if (error) {
    toast.error(i18n.t('github.toasts.authFailed', { error }));
    cleanUrl();
  } else if (sessionFromUrl && usernameFromUrl) {
    cleanUrl();
    if (!isValidSessionToken(sessionFromUrl) || !isValidGitHubUsername(usernameFromUrl)) {
      console.warn('Invalid GitHub sign-in callback rejected');
    } else {
      sessionStorage.setItem(SESSION_KEY, sessionFromUrl);
      sessionStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
      localStorage.setItem(USERNAME_KEY, usernameFromUrl);
      setState({ status: 'signed-in', session: sessionFromUrl, username: usernameFromUrl });
      toast.success(i18n.t('github.toasts.signedInAs', { username: usernameFromUrl }));
      return;
    }
  }

  const stored = sessionStorage.getItem(SESSION_KEY);
  const username = localStorage.getItem(USERNAME_KEY);
  if (!stored || !username) return;
  const age = Date.now() - parseInt(sessionStorage.getItem(SESSION_TIMESTAMP_KEY) || '0', 10);
  if (age > SESSION_MAX_AGE_MS) {
    clearStoredSession();
    setState({ status: 'expired', username });
    return;
  }
  setState({ status: 'checking', session: stored, username });
  void verifySession(stored);
}

/** Leave for GitHub's sign-in page; the callback brings the session back. */
export function signInWithGitHub(): void {
  setState({ redirecting: true });
  window.location.href = `${BACKEND_URL}/github/auth/login`;
}

/** End the session here and on the backend (which also revokes the GitHub token). */
export async function signOutOfGitHub(): Promise<void> {
  const { session } = state;
  clearStoredSession();
  localStorage.removeItem(USERNAME_KEY);
  setState(SIGNED_OUT);
  if (!session) return;
  try {
    await fetch(`${BACKEND_URL}/github/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session }),
    });
  } catch (error) {
    console.error('Failed to sign out of GitHub:', error);
  }
}

/** Tests only: start signed in with `session`, as after a verified sign-in. */
export function signInToGitHubForTests(session: string, username = 'octocat'): void {
  started = true;
  setState({ status: 'signed-in', session, username, redirecting: false });
}

/** Tests only: forget the page's sign-in so the next `startGitHubAuth` reads storage again. */
export function resetGitHubAuthForTests(): void {
  window.removeEventListener(GITHUB_SESSION_REJECTED_EVENT, markGitHubSessionExpired);
  started = false;
  state = SIGNED_OUT;
  listeners.forEach((listener) => listener());
}
