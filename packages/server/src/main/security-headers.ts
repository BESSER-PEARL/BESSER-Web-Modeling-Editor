import { RequestHandler } from 'express';
import helmet from 'helmet';

const ONE_YEAR_SECONDS = 31_536_000;

/** The URLs the webapp talks to. Each is unset or empty when it uses its same-origin default. */
export interface WebappUrls {
  deploymentUrl?: string;
  backendUrl?: string;
  botWsUrl?: string;
  posthogHost?: string;
  sentryDsn?: string;
}

const originOf = (url?: string): string[] => {
  if (!url) return [];
  try {
    return [new URL(url).origin];
  } catch {
    return [];
  }
};

/** A backend URL also serves WebSockets (the agent simulator), and CSP treats the schemes separately. */
const httpAndSocketOrigins = (url?: string): string[] =>
  originOf(url).flatMap((origin) => [origin, origin.replace(/^http/, 'ws')]);

/** PostHog lazy-loads its web-vitals script from its assets host; a self-hosted PostHog has just the one. */
const posthogAssetsOrigin = (host?: string): string[] =>
  originOf(host).map((origin) => origin.replace('.i.posthog.com', '-assets.i.posthog.com'));

const isLocalUrl = (url: string): boolean => /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

/** True unless some URL is known to be remote, so an unset runtime URL cannot open localhost on a hosted build. */
const isLocalStack = (urls: WebappUrls): boolean =>
  [urls.deploymentUrl, urls.backendUrl, urls.botWsUrl].filter((url): url is string => !!url).every(isLocalUrl);

/**
 * Paths, not hosts: a whole-host source would let injected HTML load an attacker's own container
 * (`gtm.js?id=...`) or project config (`/array/<token>/config.js`) from the same host.
 */
const GTAG_SCRIPTS = 'https://www.googletagmanager.com/gtag/';
const posthogScripts = (host?: string): string[] => posthogAssetsOrigin(host).map((origin) => `${origin}/static/`);

/** The hard-coded walkthrough. Exact paths: anything else under this prefix falls back to the editor itself. */
const WALKTHROUGH_PATHS = new Set(['/demo-agentic/', '/demo-agentic/index.html']);

/** GrapesJS loads its icon font from here by default (the `cssIcons` option). */
const GRAPESJS_ICONS = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/';

const buildDirectives = (urls: WebappUrls, scriptSrcExtra: string[] = []) => ({
  defaultSrc: ["'self'"],
  // Shiki highlights code with WebAssembly; 'wasm-unsafe-eval' still forbids eval of JavaScript.
  scriptSrc: ["'self'", "'wasm-unsafe-eval'", GTAG_SCRIPTS, ...posthogScripts(urls.posthogHost), ...scriptSrcExtra],
  // styled-components, Radix and GrapesJS all write inline styles.
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', GRAPESJS_ICONS],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', GRAPESJS_ICONS],
  // User-designed GUIs reference images by URL, and the map widget loads OpenStreetMap tiles.
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  connectSrc: [
    "'self'",
    'https://raw.githubusercontent.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
    ...httpAndSocketOrigins(urls.deploymentUrl),
    ...httpAndSocketOrigins(urls.backendUrl),
    ...httpAndSocketOrigins(urls.botWsUrl),
    ...originOf(urls.posthogHost),
    ...posthogAssetsOrigin(urls.posthogHost),
    ...originOf(urls.sentryDsn),
    // A local stack runs the backend and the agent on their own ports.
    ...(isLocalStack(urls) ? ['http://localhost:*', 'ws://localhost:*'] : []),
  ],
  // Imported and assistant-written GUIs can reference video by URL.
  mediaSrc: ["'self'", 'blob:', 'data:', 'https:'],
  workerSrc: ["'self'", 'blob:'],
  // User-designed GUIs can embed video and map iframes. A cross-origin frame cannot read this page.
  frameSrc: ["'self'", 'https:'],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
});

const headersWith = (directives: ReturnType<typeof buildDirectives>): RequestHandler =>
  helmet({
    // No defaults: they add upgrade-insecure-requests, which breaks a stack served over plain HTTP.
    contentSecurityPolicy: { useDefaults: false, directives },
    strictTransportSecurity: { maxAge: ONE_YEAR_SECONDS, includeSubDomains: false },
    xFrameOptions: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Not needed to protect the key, and each can break links and embeds that work today.
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
  });

/**
 * Security headers for everything this server sends. The BYOK key sits in sessionStorage, which any
 * script on the page can read, so `script-src` allows no inline script: keep it that way.
 * `/demo-agentic` is the exception: a hard-coded walkthrough with no user input, whose data and code are
 * inline, and which nothing can frame.
 */
export const securityHeaders = (urls: WebappUrls): RequestHandler => {
  const app = headersWith(buildDirectives(urls));
  const walkthrough = headersWith(buildDirectives(urls, ["'unsafe-inline'"]));
  return (req, res, next) => (WALKTHROUGH_PATHS.has(req.path) ? walkthrough : app)(req, res, next);
};
