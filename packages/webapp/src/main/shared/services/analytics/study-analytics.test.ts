import { describe, expect, it, vi } from 'vitest';

vi.mock('../../constants/constant', () => ({ POSTHOG_KEY: 'test-key', ENABLE_STUDY_DEPLOY: true }));

import { getConsentStatus, setConsentStatus } from './analytics-consent';
import { captureAnalyticsEvent, setPostHogModule } from './lazy-analytics';

describe('study analytics', () => {
  it('requires separate study acknowledgment before events or replay', () => {
    localStorage.clear();
    localStorage.setItem('besser_analytics_consent', JSON.stringify({ status: 'accepted', version: '2.0' }));
    expect(getConsentStatus()).toBeNull();
    captureAnalyticsEvent('gui_personalization_picker_opened');

    expect(setConsentStatus('accepted')).toBe(true);
    captureAnalyticsEvent('gui_personalization_variant_created');
    const ph = {
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      startSessionRecording: vi.fn(),
      stopSessionRecording: vi.fn(),
      capture: vi.fn(),
    };
    setPostHogModule({ default: ph } as unknown as typeof import('posthog-js'));
    expect(ph.opt_in_capturing).toHaveBeenCalledOnce();
    expect(ph.startSessionRecording).toHaveBeenCalledWith(true);
    expect(ph.capture).toHaveBeenCalledTimes(1);
    expect(ph.capture).toHaveBeenCalledWith('gui_personalization_variant_created', {});
  });
});
