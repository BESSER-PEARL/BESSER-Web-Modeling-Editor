/**
 * Sentry follows the analytics consent like PostHog does: without consent it is
 * never initialised (no events, no sessions), it starts when the user accepts,
 * stops when they decline, and every event is scrubbed before it is sent.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorEvent } from '@sentry/react';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  setTag: vi.fn(),
  close: vi.fn(() => Promise.resolve(true)),
  captureException: vi.fn(),
}));
vi.mock('@sentry/react', () => sentry);

/** A PostHog stand-in that keeps its opted-out state, like the real client. */
const posthogState = vi.hoisted(() => ({ optedOut: true }));
const posthog = vi.hoisted(() => ({
  init: vi.fn((_key: string, options: { opt_out_capturing_by_default?: boolean }) => {
    posthogState.optedOut = options.opt_out_capturing_by_default === true;
  }),
  register: vi.fn(),
  capture: vi.fn(),
  set_config: vi.fn(),
  has_opted_out_capturing: vi.fn(() => posthogState.optedOut),
  _start_queue_if_opted_in: vi.fn(),
  opt_in_capturing: vi.fn(() => {
    posthogState.optedOut = false;
  }),
  opt_out_capturing: vi.fn(() => {
    posthogState.optedOut = true;
  }),
}));
vi.mock('posthog-js', () => ({ default: posthog }));

let consented = false;
const config = (dsn: string | undefined = 'https://key@sentry.example/1') => ({
  sentryDsn: dsn,
  sentryEnvironment: 'test',
  posthogKey: 'phc_test' as string | undefined,
  posthogHost: 'https://eu.i.posthog.com' as string | undefined,
  gaMeasurementId: undefined,
  editorVersion: '9.9.9' as string | undefined,
  hasUserConsented: () => consented,
});

type Analytics = typeof import('../lazy-analytics');

/** A fresh module (its Sentry state is module-level), with the idle initializer already run. */
async function start(dsn?: string): Promise<Analytics> {
  vi.resetModules();
  const analytics = await import('../lazy-analytics');
  analytics.initLazyAnalytics(config(dsn));
  await vi.dynamicImportSettled();
  return analytics;
}

const beforeSend = () =>
  (sentry.init.mock.lastCall?.[0] as { beforeSend: (event: ErrorEvent, hint: unknown) => ErrorEvent | null })
    .beforeSend;

beforeEach(() => {
  consented = false;
  Object.values(sentry).forEach((fn) => fn.mockClear());
  Object.values(posthog).forEach((fn) => fn.mockClear());
  posthogState.optedOut = true;
  vi.stubGlobal('requestIdleCallback', (fn: () => void) => fn());
});

afterEach(() => vi.unstubAllGlobals());

describe('Sentry consent', () => {
  it('is never initialised without consent', async () => {
    const analytics = await start();
    expect(sentry.init).not.toHaveBeenCalled();
    expect(analytics.getSentry()).toBeNull();
  });

  it('is initialised, with a beforeSend, once the user has consented', async () => {
    consented = true;
    const analytics = await start();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://key@sentry.example/1', environment: 'test', beforeSend: expect.any(Function) }),
    );
    expect(analytics.getSentry()).not.toBeNull();
  });

  it('stays off without a DSN, even with consent', async () => {
    consented = true;
    const analytics = await start('');
    expect(sentry.init).not.toHaveBeenCalled();
    expect(analytics.getSentry()).toBeNull();
  });

  it('starts when the user accepts later', async () => {
    const analytics = await start();
    consented = true;
    analytics.applyAnalyticsConsent('accepted');
    await vi.dynamicImportSettled();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(analytics.getSentry()).not.toBeNull();
    expect(posthog.opt_in_capturing).toHaveBeenCalled();
  });

  it('stops when the user declines', async () => {
    consented = true;
    const analytics = await start();
    consented = false;
    analytics.applyAnalyticsConsent('declined');
    expect(sentry.close).toHaveBeenCalled();
    expect(analytics.getSentry()).toBeNull();
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
  });

  it('does not start when this tab declined before the idle initializer ran (?force_cookies=1)', async () => {
    consented = true;
    vi.resetModules();
    const analytics = await import('../lazy-analytics');
    analytics.applyAnalyticsConsent('declined');
    analytics.initLazyAnalytics(config());
    await vi.dynamicImportSettled();
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('drops events once consent is withdrawn in another tab, and scrubs them while it holds', async () => {
    consented = true;
    await start();
    const event: ErrorEvent = {
      type: undefined,
      message: 'project "Acme"',
      exception: { values: [{ type: 'Error', value: 'project "Acme"' }] },
    };
    expect(beforeSend()(event, {})).toEqual({
      type: undefined,
      user: { ip_address: null },
      exception: { values: [{ type: 'Error', value: '[redacted]' }] },
    });
    consented = false;
    expect(beforeSend()(event, {})).toBeNull();
  });
});

describe('Google Analytics consent', () => {
  const GA_ID = 'G-TEST123';
  type GaWindow = { dataLayer?: IArguments[]; gtag?: unknown; [flag: string]: unknown };
  const w = window as unknown as GaWindow;
  const gtagScripts = () => document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]');
  const disabled = () => w[`ga-disable-${GA_ID}`];

  async function startGa(): Promise<Analytics> {
    vi.resetModules();
    const analytics = await import('../lazy-analytics');
    analytics.initLazyAnalytics({ ...config(''), gaMeasurementId: GA_ID });
    return analytics;
  }

  afterEach(() => {
    gtagScripts().forEach((script) => script.remove());
    delete w.dataLayer;
    delete w.gtag;
    delete w[`ga-disable-${GA_ID}`];
  });

  it('loads nothing, and defines no gtag or dataLayer, without consent', async () => {
    const analytics = await startGa();
    analytics.applyAnalyticsConsent('declined');
    expect(gtagScripts()).toHaveLength(0);
    expect(w.gtag).toBeUndefined();
    expect(w.dataLayer).toBeUndefined();
  });

  it('loads gtag.js with advertising features off once the user has consented', async () => {
    consented = true;
    await startGa();
    expect(gtagScripts()).toHaveLength(1);
    expect((gtagScripts()[0] as HTMLScriptElement).src).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
    expect(w.dataLayer?.map((args) => Array.from(args))).toEqual([
      ['js', expect.any(Date)],
      ['config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false }],
    ]);
    expect(disabled()).toBe(false);
  });

  it('loads when the user accepts later', async () => {
    const analytics = await startGa();
    expect(gtagScripts()).toHaveLength(0);
    consented = true;
    analytics.applyAnalyticsConsent('accepted');
    expect(gtagScripts()).toHaveLength(1);
  });

  it('is disabled on withdrawal and re-enabled, without a second script, on a new accept', async () => {
    consented = true;
    const analytics = await startGa();
    consented = false;
    analytics.applyAnalyticsConsent('declined');
    expect(disabled()).toBe(true);
    consented = true;
    analytics.applyAnalyticsConsent('accepted');
    expect(disabled()).toBe(false);
    expect(gtagScripts()).toHaveLength(1);
  });

  it('does not load when this tab declined before the idle initializer ran (?force_cookies=1)', async () => {
    consented = true;
    vi.resetModules();
    const analytics = await import('../lazy-analytics');
    analytics.applyAnalyticsConsent('declined');
    analytics.initLazyAnalytics({ ...config(''), gaMeasurementId: GA_ID });
    expect(gtagScripts()).toHaveLength(0);
  });
});

describe('PostHog', () => {
  const initOptions = () => posthog.init.mock.lastCall?.[1] as Record<string, unknown>;

  it('is initialised here, with only our own events and nothing stored, before consent', async () => {
    await start('');
    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init.mock.lastCall?.[0]).toBe('phc_test');
    expect(initOptions()).toMatchObject({
      api_host: 'https://eu.i.posthog.com',
      autocapture: false,
      capture_dead_clicks: false,
      disable_session_recording: true,
      capture_pageview: false,
      opt_out_capturing_by_default: true,
      disable_persistence: true,
    });
    expect(posthog.register).toHaveBeenCalledWith({ editor_version: '9.9.9' });
  });

  it('keeps its id in a cookie when the user had already consented', async () => {
    consented = true;
    await start('');
    expect(initOptions()).toMatchObject({
      opt_out_capturing_by_default: false,
      persistence: 'localStorage+cookie',
      disable_persistence: false,
    });
  });

  it('sends events tracked before it loaded, with the time they happened', async () => {
    vi.resetModules();
    const analytics = await import('../lazy-analytics');
    const before = Date.now();
    analytics.captureEvent('early_event', { count: 1 });
    expect(posthog.capture).not.toHaveBeenCalled();
    analytics.initLazyAnalytics(config(''));
    await vi.dynamicImportSettled();
    expect(posthog.capture).toHaveBeenCalledWith('early_event', { count: 1 }, { timestamp: expect.any(Date) });
    const sentAt = (posthog.capture.mock.lastCall?.[2] as { timestamp: Date }).timestamp.getTime();
    expect(sentAt).toBeGreaterThanOrEqual(before);
    analytics.captureEvent('late_event');
    expect(posthog.capture).toHaveBeenLastCalledWith('late_event', {});
  });

  it('stores its id on Accept, and deletes it again on withdrawal', async () => {
    const analytics = await start('');
    analytics.applyAnalyticsConsent('accepted');
    expect(posthog.set_config).toHaveBeenLastCalledWith({ disable_persistence: false });
    expect(posthog.opt_in_capturing).toHaveBeenCalled();
    analytics.applyAnalyticsConsent('declined');
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.set_config).toHaveBeenLastCalledWith({ disable_persistence: true });
  });

  it('counts the page the user accepted on, which was dropped before consent', async () => {
    const analytics = await start('');
    analytics.applyAnalyticsConsent('accepted');
    expect(posthog.capture).toHaveBeenCalledWith('$pageview');
  });

  it('starts sending batched events as soon as the user accepts, not at the next page unload', async () => {
    const analytics = await start('');
    analytics.applyAnalyticsConsent('accepted');
    expect(posthog._start_queue_if_opted_in).toHaveBeenCalledTimes(1);
    expect(posthog._start_queue_if_opted_in.mock.invocationCallOrder[0]).toBeGreaterThan(
      posthog.opt_in_capturing.mock.invocationCallOrder[0],
    );
  });

  it('does not opt in again, or send another page view, on each load of a consented user', async () => {
    consented = true;
    const analytics = await start('');
    // The cookie banner re-applies the stored decision on every load.
    analytics.applyAnalyticsConsent('accepted');
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalledWith('$pageview');
  });

  it('stays opted out when this tab declined before it loaded (?force_cookies=1)', async () => {
    consented = true;
    vi.resetModules();
    const analytics = await import('../lazy-analytics');
    analytics.applyAnalyticsConsent('declined');
    analytics.initLazyAnalytics(config(''));
    await vi.dynamicImportSettled();
    expect(initOptions()).toMatchObject({ opt_out_capturing_by_default: true, disable_persistence: true });
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
  });

  it('loads nothing and queues nothing without a key', async () => {
    vi.resetModules();
    const analytics = await import('../lazy-analytics');
    analytics.captureEvent('early_event');
    analytics.initLazyAnalytics({ ...config(''), posthogKey: undefined });
    await vi.dynamicImportSettled();
    analytics.captureEvent('late_event');
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('makes no request to PostHog before consent: no remote config call, web vitals set locally', async () => {
    await start('');
    expect(initOptions()).toMatchObject({
      advanced_disable_decide: true,
      capture_performance: { web_vitals: true, network_timing: false },
    });
  });

  it('opts out at load without consent, even when an earlier consent left an opt-in stored', async () => {
    posthog.init.mockImplementationOnce(() => {
      posthogState.optedOut = false; // the stored opt-in wins over opt_out_capturing_by_default
    });
    vi.resetModules();
    const analytics = await import('../lazy-analytics');
    analytics.captureEvent('queued_before_consent');
    analytics.initLazyAnalytics(config(''));
    await vi.dynamicImportSettled();
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.opt_out_capturing.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.capture.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('strips the query and fragment inside heatmap data and web-vitals metrics too', async () => {
    const { sanitizePostHogProperties } = await import('../lazy-analytics');
    expect(
      sanitizePostHogProperties({
        $heatmap_data: {
          'https://editor.besser-pearl.org/?buml=https://raw.githubusercontent.com/acme/x': [{ x: 1 }],
          'https://editor.besser-pearl.org/#github_session=abc': [{ x: 2 }],
        },
        $web_vitals_LCP_event: { value: 900, $current_url: 'https://editor.besser-pearl.org/?demo=secret' },
      }),
    ).toEqual({
      $heatmap_data: { 'https://editor.besser-pearl.org/': [{ x: 1 }, { x: 2 }] },
      $web_vitals_LCP_event: { value: 900, $current_url: 'https://editor.besser-pearl.org/' },
    });
  });

  it('strips the query and fragment from every URL it sends (OAuth code, ?buml= link)', async () => {
    const { sanitizePostHogProperties } = await import('../lazy-analytics');
    expect(
      sanitizePostHogProperties({
        $current_url: 'https://editor.besser-pearl.org/auth/callback?code=secret#x',
        $referrer: 'https://github.com/login?return_to=/acme/repo',
        $set_once: { $initial_current_url: 'https://editor.besser-pearl.org/?buml=https://raw.githubusercontent.com/acme/x' },
        count: 3,
      }),
    ).toEqual({
      $current_url: 'https://editor.besser-pearl.org/auth/callback',
      $referrer: 'https://github.com/login',
      $set_once: { $initial_current_url: 'https://editor.besser-pearl.org/' },
      count: 3,
    });
  });
});

describe('entry point', () => {
  it('does not wrap the app in a PostHog provider, whose late load remounted the whole tree', () => {
    const app = readFileSync(resolve(__dirname, '../../../../app/application.tsx'), 'utf-8');
    expect(app).not.toMatch(/posthog/i);
  });

  it('strips the ?demo= token from the address bar before it starts any analytics', () => {
    const entry = readFileSync(resolve(__dirname, '../../../../index.tsx'), 'utf-8');
    expect(entry.indexOf('initDemoModeFromUrl();')).toBeGreaterThan(-1);
    expect(entry.indexOf('initDemoModeFromUrl();')).toBeLessThan(entry.indexOf('initLazyAnalytics({'));
  });

  it('has no Google tag outside the consent flow', () => {
    const html = readFileSync(resolve(__dirname, '../../../../../../index.html'), 'utf-8');
    expect(html).not.toMatch(/googletagmanager|gtag\(|dataLayer/);
  });
});
