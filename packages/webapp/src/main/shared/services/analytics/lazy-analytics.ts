/**
 * Lazy analytics initialization for Sentry, PostHog and Google Analytics.
 *
 * Both libraries are loaded via dynamic `import()` so they are excluded from
 * the critical rendering path. Initialization is deferred until the browser is
 * idle (via `requestIdleCallback`) or after a short timeout as a fallback.
 *
 * Consumers should call `initLazyAnalytics()` once from the entry file, and
 * `applyAnalyticsConsent()` whenever the analytics consent changes. Sentry and
 * Google Analytics load only with consent; PostHog loads always but captures only
 * with consent. Product events go through `track` in `events.ts`.
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

type PostHog = (typeof import('posthog-js'))['default'];

/** The initialised client, or `null` before it has loaded (or when no key is configured). */
let posthogClient: PostHog | null = null;
/** False once we know no PostHog key is configured: events are then dropped, not queued. */
let posthogEnabled = true;
/** This tab's last decision, applied on load; like `sentryDecision` it can only narrow the stored consent. */
let posthogDecision: ConsentStatus | null = null;

/** Events tracked before PostHog loaded (it loads when the browser is idle), sent with their own time. */
interface QueuedEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}
/** Bounds memory when PostHog never loads (blocked by an ad blocker, offline). */
const MAX_QUEUED_EVENTS = 200;
let queuedEvents: QueuedEvent[] = [];

/** Every property PostHog sends a URL in; their query and fragment can carry an OAuth `code` or a `?buml=` URL. */
const URL_PROPERTIES = ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer'];

const withoutQueryOrFragment = (url: unknown): unknown =>
  typeof url === 'string' ? url.replace(/[?#][\s\S]*$/, '') : url;

/** PostHog `sanitize_properties`: strips the query and fragment from URLs, including `$set`/`$set_once` ones. */
export function sanitizePostHogProperties(properties: Record<string, any>): Record<string, any> {
  const scrub = (props: Record<string, any>) => {
    for (const key of URL_PROPERTIES) {
      if (key in props) props[key] = withoutQueryOrFragment(props[key]);
    }
  };
  scrub(properties);
  for (const nested of ['$set', '$set_once']) {
    if (properties[nested] && typeof properties[nested] === 'object') scrub(properties[nested]);
  }
  return properties;
}

/**
 * Send a product-analytics event. Safe to call at any time: before PostHog has loaded
 * the event is queued, and PostHog itself drops it unless the user accepted analytics.
 * Prefer the typed `track` in `events.ts`, which fixes each event's properties.
 */
export function captureEvent(event: string, properties: Record<string, unknown> = {}): void {
  if (posthogClient) {
    posthogClient.capture(event, properties);
    return;
  }
  if (posthogEnabled && queuedEvents.length < MAX_QUEUED_EVENTS) {
    queuedEvents.push({ event, properties, timestamp: new Date() });
  }
}

/**
 * Apply an opt-in / opt-out decision to PostHog. Accepting also stores its id (cookie and
 * localStorage), so a returning user stays one person; declining deletes it again.
 * The banner re-applies the stored decision on every load, so only a real change opts in:
 * otherwise each page load would send another `$opt_in`.
 */
export const applyConsentToPostHog = (status: ConsentStatus): void => {
  posthogDecision = status;
  const ph = posthogClient;
  if (!ph) return;
  if (status === 'accepted') {
    if (!ph.has_opted_out_capturing()) return;
    ph.set_config({ disable_persistence: false });
    ph.opt_in_capturing();
    // posthog-js 1.186 starts its batch queue only at load, so after a later opt-in every
    // event would wait for the page to unload. Start it the way its own load does.
    (ph as unknown as { _start_queue_if_opted_in?: () => void })._start_queue_if_opted_in?.();
    // The page view of the page the user accepted on was dropped before consent.
    ph.capture('$pageview');
  } else {
    ph.opt_out_capturing();
    // Disabling persistence deletes the stored id, including one left by an earlier consent.
    ph.set_config({ disable_persistence: true });
  }
};

interface PostHogSettings {
  key: string;
  host: string | undefined;
  editorVersion: string | undefined;
  hasUserConsented: () => boolean;
}

function loadPostHog(settings: PostHogSettings): void {
  import('posthog-js')
    .then(({ default: posthog }) => {
      const consented = settings.hasUserConsented() && posthogDecision !== 'declined';
      posthog.init(settings.key, {
        api_host: settings.host,
        // Only the events we send ourselves: autocapture and dead clicks record element text,
        // which on the canvas is model content. Heatmaps (click positions) and web vitals are kept.
        autocapture: false,
        capture_dead_clicks: false,
        enable_heatmaps: true,
        disable_session_recording: true,
        disable_surveys: true,
        // The router changes pages without a reload; `trackPageview` sends those.
        capture_pageview: false,
        respect_dnt: true,
        opt_out_capturing_by_default: !consented,
        // Disabled persistence stores nothing and deletes a stale id from an earlier consent
        // (withdrawn in another tab, or asked again after a consent-version change).
        persistence: 'localStorage+cookie',
        disable_persistence: !consented,
        ip: false,
        sanitize_properties: sanitizePostHogProperties,
      });
      posthog.register({ editor_version: settings.editorVersion });
      posthogClient = posthog;
      if (posthogDecision !== null) applyConsentToPostHog(posthogDecision);
      const queued = queuedEvents;
      queuedEvents = [];
      for (const { event, properties, timestamp } of queued) {
        posthog.capture(event, properties, { timestamp });
      }
    })
    .catch((err) => {
      posthogEnabled = false;
      queuedEvents = [];
      console.warn('[analytics] Failed to load PostHog:', err);
    });
}

// ── Google Analytics ────────────────────────────────────────────────────────

interface GoogleAnalyticsSettings {
  measurementId: string;
  hasUserConsented: () => boolean;
}

/** The globals gtag.js reads: `dataLayer`, `gtag` and the `ga-disable-<id>` opt-out flag. */
type GtagWindow = { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; [disableFlag: string]: unknown };
const gtagWindow = () => window as unknown as GtagWindow;

let gaSettings: GoogleAnalyticsSettings | null = null;
let gaLoaded = false;
/** Like `sentryDecision`: this tab's last decision, which can only narrow the stored consent. */
let gaDecision: ConsentStatus | null = null;

const gaDisableFlag = (measurementId: string) => `ga-disable-${measurementId}`;

/** Inject gtag.js once consent is given; Google's opt-out flag stops it again on withdrawal. */
function loadGoogleAnalytics(): void {
  const settings = gaSettings;
  if (!settings || !settings.hasUserConsented() || (gaDecision !== null && gaDecision !== 'accepted')) return;
  const w = gtagWindow();
  w[gaDisableFlag(settings.measurementId)] = false;
  if (gaLoaded) return;
  gaLoaded = true;
  const dataLayer = (w.dataLayer = w.dataLayer || []);
  // gtag.js expects the `arguments` object itself, not an array.
  w.gtag = function gtag() {
    dataLayer.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', settings.measurementId, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(settings.measurementId)}`;
  document.head.appendChild(script);
}

/** Load Google Analytics on consent; disable it (no further hits) when consent is withdrawn. */
export const applyConsentToGoogleAnalytics = (status: ConsentStatus): void => {
  gaDecision = status;
  if (status === 'accepted') {
    loadGoogleAnalytics();
  } else if (gaSettings) {
    gtagWindow()[gaDisableFlag(gaSettings.measurementId)] = true;
  }
};

/** Apply an analytics consent decision to Sentry, PostHog and Google Analytics. */
export const applyAnalyticsConsent = (status: ConsentStatus): void => {
  applyConsentToSentry(status);
  applyConsentToPostHog(status);
  applyConsentToGoogleAnalytics(status);
};

// ── Deferred initializer ────────────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 3500;

interface AnalyticsConfig {
  sentryDsn: string | undefined;
  sentryEnvironment: string;
  posthogKey: string | undefined;
  posthogHost: string | undefined;
  gaMeasurementId: string | undefined;
  editorVersion: string | undefined;
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
 * Sentry, PostHog and Google Analytics without blocking the first render.
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

    // ── Google Analytics ──────────────────────────────────────────────────
    if (config.gaMeasurementId) {
      gaSettings = { measurementId: config.gaMeasurementId, hasUserConsented: config.hasUserConsented };
      loadGoogleAnalytics();
    }

    // ── PostHog ───────────────────────────────────────────────────────────
    // Loaded always (so events queued before load can be sent or dropped by its
    // consent check), but it captures only after Accept.
    if (config.posthogKey) {
      loadPostHog({
        key: config.posthogKey,
        host: config.posthogHost,
        editorVersion: config.editorVersion,
        hasUserConsented: config.hasUserConsented,
      });
    } else {
      posthogEnabled = false;
      queuedEvents = [];
    }
  });
}
