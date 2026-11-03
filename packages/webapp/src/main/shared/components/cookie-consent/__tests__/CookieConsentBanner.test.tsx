/**
 * Every analytics provider the editor loads after consent must be named in the
 * banner details and on the privacy page.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/analytics/lazy-analytics', () => ({ applyAnalyticsConsent: vi.fn() }));

import { CookieConsentBanner } from '../CookieConsentBanner';

describe('CookieConsentBanner', () => {
  it('names Google Analytics, Sentry and PostHog, with what Google Analytics collects', () => {
    render(<CookieConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('Visit statistics (Google Analytics)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }));
    expect(
      screen.getByText(
        'Visit statistics: pages visited, approximate location derived from your IP address, device and browser type',
      ),
    ).toBeInTheDocument();
    for (const [name, href] of [
      ['Google Privacy Policy', 'https://policies.google.com/privacy'],
      ['Sentry Privacy Policy', 'https://sentry.io/privacy/'],
      ['PostHog Privacy Policy', 'https://posthog.com/privacy'],
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });
});
