const GITHUB_SESSION_KEY = 'github_session';

/**
 * Return the current GitHub session as a backend header.
 *
 * The session remains scoped to ``sessionStorage`` and is read immediately
 * before a request. It is never copied into Redux, URLs, logs, or persisted
 * project data.
 */
export function readGitHubSession(): string | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  const session = window.sessionStorage.getItem(GITHUB_SESSION_KEY)?.trim();
  return session || null;
}

export function githubSessionHeaders(): Record<string, string> {
  const session = readGitHubSession();
  return session ? { 'X-GitHub-Session': session } : {};
}
