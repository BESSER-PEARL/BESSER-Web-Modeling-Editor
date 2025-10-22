import React from 'react';
import * as Sentry from '@sentry/react';
import { RoutedApplication } from './application';
import { setTheme } from './utils/theme-switcher';
import { LocalStorageRepository } from '../main/services/local-storage/local-storage-repository';
import { createRoot } from 'react-dom/client';
import { NO_HTTP_URL, SENTRY_DSN } from './constant';

import 'bootstrap/dist/css/bootstrap.css';
import './styles.css';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NO_HTTP_URL,
    tracesSampleRate: 0.5,
  });

  Sentry.setTag('package', 'webapp');
}
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
root.render(<RoutedApplication />);
