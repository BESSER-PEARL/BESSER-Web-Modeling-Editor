/**
 * Demo sessions.
 *
 * A tab opened through `?demo=<token>` routes its generation runs to the
 * server-paid `sponsored` tier (the operator's own key on a strong model)
 * instead of the keyless free tier, so no key has to be pasted.
 *
 * The token is a shared secret the backend checks against `BESSER_DEMO_TOKEN`
 * (an unset env there keeps the tier closed). It is a bearer secret in a URL:
 * fine for a link pasted into your own browser before a demo, not for a slide
 * or a shared invite. Kept in `sessionStorage`, so it dies with the tab and
 * never follows the user into ordinary browsing.
 *
 * Mirrors `initPilotModeFromUrl` in services/telemetry/pilotTelemetry.ts.
 */

/** Per-tab storage key. Not `localStorage` — a demo must not outlive the tab. */
const sessionStorageDemoToken = 'besser-demo-token';

/**
 * URL-safe token of a plausible length. The minimum is the point: it stops a
 * stray `?demo=1` from putting a tab on the operator's paid key, and anything the
 * backend would accept is far longer than this anyway.
 */
const DEMO_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Read the `demo` URL query parameter on app load and store a valid token for
 * the tab. Idempotent and safe in any environment (SSR, sandboxed iframe,
 * tests) — an unavailable URL or storage simply leaves demo mode off.
 */
export const initDemoModeFromUrl = (): void => {
  try {
    if (typeof window === 'undefined') return;
    const token = new URLSearchParams(window.location.search).get('demo');
    if (token && DEMO_TOKEN_PATTERN.test(token)) {
      window.sessionStorage.setItem(sessionStorageDemoToken, token);
    }
  } catch {
    // Storage or URL unavailable — demo mode simply stays off.
  }
};

/**
 * This tab's demo token, or null when demo mode is off (the overwhelmingly
 * common case). Validated on read so a corrupted stored value can never reach
 * a request.
 */
export const getDemoToken = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    const stored = window.sessionStorage.getItem(sessionStorageDemoToken);
    return stored && DEMO_TOKEN_PATTERN.test(stored) ? stored : null;
  } catch {
    return null;
  }
};
