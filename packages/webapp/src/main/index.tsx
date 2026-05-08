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

// ── Auto-recovery: clear stale localStorage on crash and reload once ────
const CRASH_GUARD_KEY = 'besser_crash_recovery';
const crashGuard = sessionStorage.getItem(CRASH_GUARD_KEY);

if (!crashGuard) {
  // First load this session — arm the guard so a crash triggers cleanup
  sessionStorage.setItem(CRASH_GUARD_KEY, 'pending');

  window.addEventListener('error', () => {
    if (sessionStorage.getItem(CRASH_GUARD_KEY) !== 'pending') return;
    sessionStorage.setItem(CRASH_GUARD_KEY, 'recovered');
    // Clear all besser_* localStorage
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('besser_')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    // Clear legacy non-prefixed keys
    ['latestDiagram', 'agentConfig', 'agentPersonalization', 'github_session',
     'github_username', 'last_published_token', 'last_published_type',
     'umlAgentRateLimiterState'].forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  });
}

// Run localStorage schema migrations before anything else reads stored data
runStorageMigrations();

// If we got here without crashing, clear the guard
sessionStorage.setItem(CRASH_GUARD_KEY, 'ok');

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
