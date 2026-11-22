import React from 'react';
import { RoutedApplication } from './app/application';
import { OfflineBanner } from './shared/components/offline-banner/OfflineBanner';
import { setTheme } from './shared/utils/theme-switcher';
import { LocalStorageRepository } from './shared/services/storage/local-storage-repository';
import { createRoot } from 'react-dom/client';
import { NO_HTTP_URL, SENTRY_DSN, POSTHOG_HOST, POSTHOG_KEY, GA_MEASUREMENT_ID, EDITOR_VERSION } from './shared/constants/constant';
import { runStorageMigrations } from './shared/services/storage/storage-migration';
import { claimChunkReload } from './shared/services/storage/tabStorage';
import { initPilotModeFromUrl } from './shared/services/telemetry/pilotTelemetry';
import { initDemoModeFromUrl } from './shared/services/demoMode';
import { initLazyAnalytics } from './shared/services/analytics/lazy-analytics';
import { trackUncaughtErrors } from './shared/services/analytics/events';
import { hasUserConsented } from './shared/components/cookie-consent/CookieConsentBanner';

// Initialise i18next (language detection + resource bundles) before first render.
import { i18nReady } from './shared/i18n';

import './styles.css';

// Run localStorage schema migrations before anything else reads stored data
runStorageMigrations();

// Opt-in research study mode: capture the `?study=<label>` (or legacy
// `?pilot=<label>`) parameter before the router can touch the URL. Without it
// this is a no-op and no telemetry is ever produced.
initPilotModeFromUrl();

// Demo mode: capture the `?demo=<token>` secret before the router can
// touch the URL. Without the parameter this is a no-op and runs use the
// ordinary free tier.
initDemoModeFromUrl();

// Every deploy replaces the content-hashed lazy chunks, so a tab that stayed
// open across a deploy fails its next dynamic import ("Failed to fetch
// dynamically imported module") and surfaced an Editor Error. Vite emits
// vite:preloadError for exactly this — reload ONCE to pick up the new build
// (guarded per-session so a genuinely broken deploy can't reload-loop).
window.addEventListener('vite:preloadError', (event) => {
  if (!claimChunkReload()) return;
  event.preventDefault();
  window.location.reload();
});

// Defer Sentry + PostHog + Google Analytics initialization until the browser is idle.
// This removes ~40KB+ of synchronous JS from the critical render path. It runs after
// initPilotModeFromUrl and initDemoModeFromUrl, so no analytics ever sees a `?demo=`
// token or a `?study=`/`?pilot=` label in the address bar.
initLazyAnalytics({
  sentryDsn: SENTRY_DSN,
  sentryEnvironment: NO_HTTP_URL,
  posthogKey: POSTHOG_KEY,
  posthogHost: POSTHOG_HOST,
  gaMeasurementId: GA_MEASUREMENT_ID,
  editorVersion: EDITOR_VERSION,
  hasUserConsented,
});
trackUncaughtErrors();
const themePreference = LocalStorageRepository.getUserThemePreference();

if (themePreference === 'dark') {
  // Set user theme preference to dark if it was set
  setTheme('dark');
} else {
  // Always set system theme preference to light if no user preference is set
  LocalStorageRepository.setSystemThemePreference('light');
  setTheme('light');
}

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
// Wait for the active language's chunk so the first paint is already translated.
void i18nReady.then(() =>
  root.render(
    <>
      <RoutedApplication />
      <OfflineBanner />
    </>,
  ),
);
