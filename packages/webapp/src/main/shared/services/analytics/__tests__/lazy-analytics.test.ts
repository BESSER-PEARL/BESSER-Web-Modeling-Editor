/**
 * Sentry follows the analytics consent like PostHog does: without consent it is
 * never initialised (no events, no sessions), it starts when the user accepts,
 * stops when they decline, and every event is scrubbed before it is sent.
 */
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
      exception: { values: [{ type: 'Error', value: '[redacted]' }] },
    });
    consented = false;
    expect(beforeSend()(event, {})).toBeNull();
  });
});
