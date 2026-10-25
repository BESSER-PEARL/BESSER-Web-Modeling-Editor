import { describe, expect, it, vi } from 'vitest';

vi.mock('../../constants/constant', () => ({ POSTHOG_KEY: 'test-key', ENABLE_STUDY_DEPLOY: false }));

import { getConsentStatus, setConsentStatus } from './analytics-consent';
import { captureAnalyticsEvent, identifyStudyParticipant, setPostHogModule } from './lazy-analytics';
import { createPostHogOptions } from './posthog-options';

describe('lazy PostHog events', () => {
  it('identifies the participant before flushing queued GUI events', () => {
    expect(setConsentStatus('accepted')).toBe(true);
    const calls: string[] = [];
    const ph = {
      opt_in_capturing: vi.fn(() => calls.push('opt_in')),
      opt_out_capturing: vi.fn(() => calls.push('opt_out')),
      identify: vi.fn(() => calls.push('identify')),
      register: vi.fn(() => calls.push('register')),
      capture: vi.fn(() => calls.push('capture')),
    };
    captureAnalyticsEvent('gui_personalization_variant_created', { simple_text: true, visual_fallback: false });
    identifyStudyParticipant('participant-1');
    setPostHogModule({ default: ph } as unknown as typeof import('posthog-js'));
    expect(calls).toEqual(['opt_in', 'identify', 'register', 'capture']);
    expect(ph.capture).toHaveBeenCalledWith('gui_personalization_variant_created', { simple_text: true, visual_fallback: false });
    expect(setConsentStatus('declined')).toBe(true);
    captureAnalyticsEvent('gui_personalization_variant_deleted');
    expect(ph.capture).toHaveBeenCalledTimes(1);
    expect(getConsentStatus()).toBe('declined');
  });

  it('disables replay and automatic capture outside study mode', () => {
    expect(createPostHogOptions(false, 'https://eu.i.posthog.com')).toMatchObject({
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      opt_out_capturing_by_default: true,
      opt_out_capturing_cookie_prefix: 'besser_normal_v2',
      respect_dnt: true,
    });
    expect(createPostHogOptions(true, 'https://eu.i.posthog.com')).toMatchObject({
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: false,
      opt_out_capturing_by_default: true,
      opt_out_capturing_cookie_prefix: 'besser_study_v2',
      respect_dnt: false,
    });
  });
});
