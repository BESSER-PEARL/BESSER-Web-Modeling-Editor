/**
 * Lazy analytics initialization for Sentry and PostHog.
 *
 * PostHog is initialized by LazyPostHogProvider (not by a React PostHogProvider
 * wrapper) to avoid remounting the entire child tree when PostHog loads.
 * Use setPostHogModule() from LazyPostHogProvider once posthog.init() completes.
 *
 * Consumers should call `initLazyAnalytics()` once from the entry file (for Sentry).
 * For PostHog opt-in/opt-out at runtime, use `getPostHog()`.
 */

import { getConsentStatus, type ConsentStatus } from './analytics-consent';
import { ENABLE_STUDY_DEPLOY, POSTHOG_KEY } from '../../constants/constant';

// ── Sentry ──────────────────────────────────────────────────────────────────

let sentryModule: typeof import('@sentry/react') | null = null;

/**
 * Returns the lazily-loaded Sentry module, or `null` if it hasn't loaded yet.
 */
export const getSentry = (): typeof import('@sentry/react') | null => sentryModule;

// ── PostHog ─────────────────────────────────────────────────────────────────

let posthogModule: typeof import('posthog-js') | null = null;
type AnalyticsProperties = Record<string, string | number | boolean>;
const pendingEvents: Array<{ name: string; properties: AnalyticsProperties }> = [];
let pendingStudyParticipantId: string | null = null;

/** Retain a bounded set of non-content events until the optional SDK is ready. */
export const captureAnalyticsEvent = (name: string, properties: AnalyticsProperties = {}): void => {
  if (!POSTHOG_KEY || getConsentStatus() !== 'accepted') return;
  const ph = getPostHog();
  if (ph) {
    ph.capture(name, properties);
  } else if (pendingEvents.length < 100) {
    pendingEvents.push({ name, properties });
  }
};

/** Associate queued and future study events with the existing pseudonymous ID. */
export const identifyStudyParticipant = (participantId: string): void => {
  if (!POSTHOG_KEY || getConsentStatus() !== 'accepted') return;
  const ph = getPostHog();
  if (ph) {
    ph.identify(participantId);
    ph.register({ participant_id: participantId, study_mode: true });
  } else {
    pendingStudyParticipantId = participantId;
  }
};

/**
 * Returns the lazily-loaded PostHog default export, or `null` if it hasn't
 * loaded yet.
 */
export const getPostHog = (): (typeof import('posthog-js'))['default'] | null =>
  posthogModule?.default ?? null;

/**
 * Called by LazyPostHogProvider after posthog.init() completes.
 * Applies the persisted decision before flushing consented events.
 */
export const setPostHogModule = (mod: typeof import('posthog-js')): void => {
  posthogModule = mod;
  const consent = getConsentStatus();
  applyConsentToPostHog(consent === 'accepted' ? 'accepted' : 'declined');
  if (consent === 'accepted' && pendingStudyParticipantId !== null) {
    identifyStudyParticipant(pendingStudyParticipantId);
  }
  pendingStudyParticipantId = null;
  for (const event of pendingEvents.splice(0)) {
    if (consent === 'accepted') mod.default.capture(event.name, event.properties);
  }
};

/**
 * Apply an opt-in / opt-out decision to PostHog.
 * Before the SDK loads, setPostHogModule reads the persisted decision on load.
 */
export const applyConsentToPostHog = (status: ConsentStatus): void => {
  const ph = getPostHog();
  if (ph) {
    if (status === 'accepted') {
      ph.opt_in_capturing();
      if (ENABLE_STUDY_DEPLOY) ph.startSessionRecording(true);
    } else {
      if (ENABLE_STUDY_DEPLOY) ph.stopSessionRecording();
      ph.opt_out_capturing();
    }
    return;
  }
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
 * Call once from the application entry file to lazily load Sentry.
 * PostHog is initialized separately by LazyPostHogProvider in the React tree.
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
          Sentry.setTag('package', 'webapp');
        })
        .catch((err) => {
          console.warn('[analytics] Failed to load Sentry:', err);
        });
    }
  });
}
