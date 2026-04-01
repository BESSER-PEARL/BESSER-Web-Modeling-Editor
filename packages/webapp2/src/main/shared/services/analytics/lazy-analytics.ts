/**
 * Lazy analytics initialization for Sentry and PostHog.
 *
 * Both libraries are loaded via dynamic `import()` so they are excluded from
 * the critical rendering path. Initialization is deferred until the browser is
 * idle (via `requestIdleCallback`) or after a short timeout as a fallback.
 *
 * Consumers should call `initLazyAnalytics()` once from the entry file.
 * For PostHog opt-in/opt-out at runtime, use `getPostHog()` which returns the
 * lazily-resolved module (or `null` if it hasn't loaded yet).
 */

import type { ConsentStatus } from '../../components/cookie-consent/CookieConsentBanner';

// ── Sentry ──────────────────────────────────────────────────────────────────

let sentryModule: typeof import('@sentry/react') | null = null;

/**
 * Returns the lazily-loaded Sentry module, or `null` if it hasn't loaded yet.
 */
export const getSentry = (): typeof import('@sentry/react') | null => sentryModule;

// ── PostHog ─────────────────────────────────────────────────────────────────

let posthogModule: typeof import('posthog-js') | null = null;

/**
 * Returns the lazily-loaded PostHog default export, or `null` if it hasn't
 * loaded yet.
 */
export const getPostHog = (): (typeof import('posthog-js'))['default'] | null =>
  posthogModule?.default ?? null;

/**
 * Queue of consent operations that arrived before PostHog was loaded.
 * Once PostHog is ready we flush and apply them in order.
 */
let pendingConsentStatus: ConsentStatus | null = null;

/**
 * Apply an opt-in / opt-out decision to PostHog.
 * If PostHog hasn't loaded yet the decision is queued and applied on load.
 */
export const applyConsentToPostHog = (status: ConsentStatus): void => {
  const ph = getPostHog();
  if (ph) {
    if (status === 'accepted') {
      ph.opt_in_capturing();
    } else {
      ph.opt_out_capturing();
    }
    return;
  }
  // PostHog not loaded yet -- remember so we can apply when it arrives.
  pendingConsentStatus = status;
};

// ── Deferred initializer ────────────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 3500;

interface AnalyticsConfig {
  sentryDsn: string | undefined;
  sentryEnvironment: string;
  posthogKey: string | undefined;
  posthogHost: string | undefined;
  hasUserConsented: () => boolean;
}

function scheduleWhenIdle(fn: () => void): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(fn, 2000);
  }
}

/**
 * Call once from the application entry file to lazily load and initialize
 * Sentry and PostHog without blocking the first render.
 */
export function initLazyAnalytics(config: AnalyticsConfig): void {
  scheduleWhenIdle(() => {
    // ── Sentry ────────────────────────────────────────────────────────────
    if (config.sentryDsn) {
      import('@sentry/react')
        .then((Sentry) => {
          sentryModule = Sentry;
          Sentry.init({
            dsn: config.sentryDsn,
            environment: config.sentryEnvironment,
            tracesSampleRate: 0.5,
          });
          Sentry.setTag('package', 'webapp2');
        })
        .catch((err) => {
          console.warn('[analytics] Failed to load Sentry:', err);
        });
    }

    // ── PostHog ───────────────────────────────────────────────────────────
    // PostHog is loaded by <PostHogProvider> in the React tree, but we also
    // need the module available for consent toggling. Pre-warm it here.
    import('posthog-js')
      .then((mod) => {
        posthogModule = mod;
        // Flush any consent decision that was queued before load.
        if (pendingConsentStatus !== null) {
          applyConsentToPostHog(pendingConsentStatus);
          pendingConsentStatus = null;
        }
      })
      .catch((err) => {
        console.warn('[analytics] Failed to load PostHog:', err);
      });
  });
}
