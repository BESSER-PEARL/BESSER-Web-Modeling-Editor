import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../constants/constant', () => ({ POSTHOG_KEY: 'test-key', ENABLE_STUDY_DEPLOY: false }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../services/analytics/lazy-analytics', () => ({ applyConsentToPostHog: vi.fn() }));

import { CookieConsentBanner } from './CookieConsentBanner';
import { getConsentStatus } from '../../services/analytics/analytics-consent';
import { applyConsentToPostHog } from '../../services/analytics/lazy-analytics';

describe('ordinary analytics consent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('keeps analytics off when the user declines', () => {
    render(<CookieConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'shared.cookie.banner.decline' }));
    expect(getConsentStatus()).toBe('declined');
    expect(applyConsentToPostHog).toHaveBeenCalledWith('declined');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts limited analytics only after the user accepts', () => {
    render(<CookieConsentBanner />);
    expect(applyConsentToPostHog).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'shared.cookie.banner.accept' }));
    expect(getConsentStatus()).toBe('accepted');
    expect(applyConsentToPostHog).toHaveBeenCalledWith('accepted');
    fireEvent.click(screen.getByRole('button', { name: 'shared.cookie.settingsButton' }));
    fireEvent.click(screen.getByRole('button', { name: 'shared.cookie.banner.decline' }));
    expect(getConsentStatus()).toBe('declined');
    expect(applyConsentToPostHog).toHaveBeenCalledWith('declined');
  });
});
