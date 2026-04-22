import React from 'react';
import { RoutedApplication } from './app/application';
import { OfflineBanner } from './shared/components/offline-banner/OfflineBanner';
import { setTheme } from './shared/utils/theme-switcher';
import { LocalStorageRepository } from './shared/services/storage/local-storage-repository';
import { createRoot } from 'react-dom/client';
import { NO_HTTP_URL, SENTRY_DSN, POSTHOG_HOST, POSTHOG_KEY } from './shared/constants/constant';
import { runStorageMigrations } from './shared/utils/storage-migration';
import { initLazyAnalytics } from './shared/services/analytics/lazy-analytics';
import { hasUserConsented } from './shared/components/cookie-consent/CookieConsentBanner';

import './styles.css';

// Run localStorage schema migrations before anything else reads stored data
runStorageMigrations();

// Defer Sentry + PostHog initialization until the browser is idle.
// This removes ~40KB+ of synchronous JS from the critical render path.
initLazyAnalytics({
  sentryDsn: SENTRY_DSN,
  sentryEnvironment: NO_HTTP_URL,
  posthogKey: POSTHOG_KEY,
  posthogHost: POSTHOG_HOST,
  hasUserConsented,
});
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
root.render(
  <>
    <RoutedApplication />
    <OfflineBanner />
  </>,
);
