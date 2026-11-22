/**
 * The real posthog-js (not a stand-in) with our options: before consent the page
 * makes no request to PostHog at all, neither an API call nor an extension script.
 * posthog-js is one instance per page, so this file holds one scenario.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let consented = false;
const config = {
  sentryDsn: undefined,
  sentryEnvironment: 'test',
  posthogKey: 'phc_test',
  posthogHost: 'https://eu.i.posthog.com',
  gaMeasurementId: undefined,
  editorVersion: '9.9.9',
  hasUserConsented: () => consented,
};

/** Every request the page starts: injected scripts, fetch, XHR and beacons. */
let requests: string[] = [];

beforeEach(() => {
  requests = [];
  consented = false;
  localStorage.clear();
  vi.stubGlobal('requestIdleCallback', (fn: () => void) => {
    fn();
    return 0;
  });
  vi.stubGlobal('fetch', (url: string) => {
    requests.push(`fetch ${url}`);
    return new Promise(() => {});
  });
  // jsdom has no sendBeacon.
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (url: string) => {
      requests.push(`beacon ${url}`);
      return true;
    },
  });
  vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(function (_method: string, url: string | URL) {
    requests.push(`xhr ${String(url)}`);
  });
  vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {});
  for (const method of ['appendChild', 'insertBefore'] as const) {
    const original = Node.prototype[method] as (...args: Node[]) => Node;
    vi.spyOn(Node.prototype, method).mockImplementation(function (this: Node, node: Node, ...rest: Node[]) {
      if (node instanceof HTMLScriptElement) requests.push(`script ${node.src}`);
      return original.call(this, node, ...rest);
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function start() {
  vi.resetModules();
  const analytics = await import('../lazy-analytics');
  analytics.initLazyAnalytics(config);
  await vi.dynamicImportSettled();
  // PostHog loads its extensions on a timer after init.
  await new Promise((resolve) => setTimeout(resolve, 300));
  return analytics;
}

describe('posthog-js before consent', () => {
  it('makes no request to PostHog, and stores no id', async () => {
    const analytics = await start();
    analytics.captureEvent('pre_consent_event', { count: 1 });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requests).toEqual([]);
    expect(Object.keys(localStorage).filter((key) => key.startsWith('ph_'))).toEqual([]);
  });
});
