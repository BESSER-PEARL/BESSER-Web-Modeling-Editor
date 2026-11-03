/**
 * Every analytics provider the editor loads after consent must be named in the
 * banner details and on the privacy page.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/analytics/lazy-analytics', () => ({ applyAnalyticsConsent: vi.fn() }));

import { applyAnalyticsConsent } from '../../../services/analytics/lazy-analytics';
import { localStorageAnalyticsConsent } from '../../../constants/constant';
import { CookieConsentBanner, hasUserConsented } from '../CookieConsentBanner';

const storeConsent = (version: string) =>
  localStorage.setItem(
    localStorageAnalyticsConsent,
    JSON.stringify({ status: 'accepted', timestamp: '2026-10-01T00:00:00.000Z', version }),
  );

describe('CookieConsentBanner', () => {
  it('names Google Analytics, Sentry and PostHog, with what Google Analytics collects', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByText('Analytics and error reports to improve BESSER.')).toBeInTheDocument();
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

  describe('consent given before Google Analytics was named (version 1.2)', () => {
    afterEach(() => {
      localStorage.clear();
      vi.mocked(applyAnalyticsConsent).mockClear();
    });

    it('asks again and keeps analytics off until the user answers', () => {
      storeConsent('1.2');
      expect(hasUserConsented()).toBe(false);

      render(<CookieConsentBanner />);
      expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
      expect(applyAnalyticsConsent).toHaveBeenCalledWith('declined');
      expect(JSON.parse(localStorage.getItem(localStorageAnalyticsConsent)!)).toMatchObject({
        status: 'pending',
        version: '1.3',
      });
    });

    it('does not ask a user who accepted the current version', () => {
      storeConsent('1.3');
      expect(hasUserConsented()).toBe(true);

      render(<CookieConsentBanner />);
      expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
      expect(applyAnalyticsConsent).toHaveBeenCalledWith('accepted');
    });
  });
});
