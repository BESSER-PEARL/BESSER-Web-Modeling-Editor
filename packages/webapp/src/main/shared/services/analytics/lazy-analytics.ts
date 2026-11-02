/**
 * Lazy analytics initialization for Sentry and PostHog.
 *
 * Both libraries are loaded via dynamic `import()` so they are excluded from
 * the critical rendering path. Initialization is deferred until the browser is
 * idle (via `requestIdleCallback`) or after a short timeout as a fallback.
 *
 * Consumers should call `initLazyAnalytics()` once from the entry file, and
 * `applyAnalyticsConsent()` whenever the analytics consent changes. Sentry loads
 * only with consent; PostHog loads always but captures only with consent.
 */

import type { ConsentStatus } from '../../components/cookie-consent/CookieConsentBanner';
import { scrubSentryEvent } from './scrubSentryEvent';

// ── Sentry ──────────────────────────────────────────────────────────────────

let sentryModule: typeof import('@sentry/react') | null = null;

/**
 * Returns the initialised Sentry module, or `null` when it hasn't loaded yet or
 * the user has not consented to analytics.
 */
export const getSentry = (): typeof import('@sentry/react') | null => sentryModule;

interface SentrySettings {
  dsn: string;
  environment: string;
  hasUserConsented: () => boolean;
}

/** Set once the deferred initializer has run; until then nothing loads. */
let sentrySettings: SentrySettings | null = null;
let sentryLoading = false;
/** The last decision applied in this tab; it can only narrow the stored consent (e.g. `?force_cookies=1`). */
let sentryDecision: ConsentStatus | null = null;

const sentryConsented = (settings: SentrySettings): boolean =>
  settings.hasUserConsented() && (sentryDecision === null || sentryDecision === 'accepted');

function loadSentry(): void {
  const settings = sentrySettings;
  if (!settings || sentryModule || sentryLoading || !sentryConsented(settings)) return;
  sentryLoading = true;
  import('@sentry/react')
    .then((Sentry) => {
      // Consent may have been withdrawn while the chunk loaded.
      if (!sentryConsented(settings)) return;
      Sentry.init({
        dsn: settings.dsn,
        environment: settings.environment,
        tracesSampleRate: 0.5,
        // Re-checked per event: consent can be withdrawn in another tab.
        beforeSend: (event, hint) => (sentryConsented(settings) ? scrubSentryEvent(event, hint) : null),
      });
      Sentry.setTag('package', 'webapp');
      sentryModule = Sentry;
    })
    .catch((err) => {
      console.warn('[analytics] Failed to load Sentry:', err);
    })
    .finally(() => {
      sentryLoading = false;
    });
}

/** Start Sentry on consent; stop it (no further events or sessions) when consent is withdrawn. */
export const applyConsentToSentry = (status: ConsentStatus): void => {
  sentryDecision = status;
  if (status === 'accepted') {
    loadSentry();
    return;
  }
  if (sentryModule) {
    void sentryModule.close();
    sentryModule = null;
  }
};

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

/** Apply an analytics consent decision to both Sentry and PostHog. */
export const applyAnalyticsConsent = (status: ConsentStatus): void => {
  applyConsentToSentry(status);
  applyConsentToPostHog(status);
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
      sentrySettings = {
        dsn: config.sentryDsn,
        environment: config.sentryEnvironment,
        hasUserConsented: config.hasUserConsented,
      };
      loadSentry();
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
