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

const posthog = vi.hoisted(() => ({ opt_in_capturing: vi.fn(), opt_out_capturing: vi.fn() }));
vi.mock('posthog-js', () => ({ default: posthog }));

let consented = false;
const config = (dsn: string | undefined = 'https://key@sentry.example/1') => ({
  sentryDsn: dsn,
  sentryEnvironment: 'test',
  posthogKey: undefined,
  posthogHost: undefined,
  gaMeasurementId: undefined,
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

describe('entry point', () => {
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
