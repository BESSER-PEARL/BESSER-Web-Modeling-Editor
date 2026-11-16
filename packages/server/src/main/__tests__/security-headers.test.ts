import fs from 'fs';
import { AddressInfo } from 'net';
import path from 'path';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { securityHeaders, WebappUrls } from '../security-headers';

const HOSTED: WebappUrls = {
  deploymentUrl: 'https://editor.example.com',
  backendUrl: 'https://api.example.com/besser_api',
  botWsUrl: 'wss://agent.example.com/agent',
  posthogHost: 'https://eu.i.posthog.com',
  sentryDsn: 'https://public@o1.ingest.sentry.io/1',
};

let close = () => {};
afterEach(() => close());

const headersOf = async (urls: WebappUrls, url = '/') => {
  const app = express();
  app.use(securityHeaders(urls));
  app.get('/*', (_req, res) => void res.send('ok'));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  close = () => server.close();
  const response = await fetch(`http://localhost:${(server.address() as AddressInfo).port}${url}`);
  return response.headers;
};

const directive = (csp: string | null, name: string): string[] =>
  (csp ?? '')
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find(([key]) => key === name)
    ?.slice(1) ?? [];

const policyOf = async (urls: WebappUrls, url = '/') => (await headersOf(urls, url)).get('content-security-policy');

describe('securityHeaders', () => {
  it('sends the headers the live editor was missing', async () => {
    const headers = await headersOf(HOSTED);
    expect(headers.get('strict-transport-security')).toBe('max-age=31536000');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('x-powered-by')).toBeNull();
  });

  it('closes the ways around the policy', async () => {
    const csp = await policyOf(HOSTED);
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(csp).not.toContain('*;');
  });

  it('allows no inline or evaluated script, the way XSS would read the key', async () => {
    const scriptSrc = directive(await policyOf(HOSTED), 'script-src');
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('allows script from analytics paths only, not from their whole hosts', async () => {
    const scriptSrc = directive(await policyOf(HOSTED), 'script-src');
    expect(scriptSrc).toContain('https://www.googletagmanager.com/gtag/');
    expect(scriptSrc).toContain('https://eu-assets.i.posthog.com/static/');
    expect(scriptSrc).not.toContain('https://www.googletagmanager.com');
    expect(scriptSrc).not.toContain('https://eu-assets.i.posthog.com');
  });

  it('allows WebAssembly, which code highlighting needs', async () => {
    expect(directive(await policyOf(HOSTED), 'script-src')).toContain("'wasm-unsafe-eval'");
  });

  it('allows each configured service', async () => {
    expect(directive(await policyOf(HOSTED), 'connect-src')).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://editor.example.com',
        'https://api.example.com',
        'wss://api.example.com',
        'wss://agent.example.com',
        'https://eu.i.posthog.com',
        'https://o1.ingest.sentry.io',
        'https://raw.githubusercontent.com',
      ]),
    );
  });

  it('allows what the GUI editor loads', async () => {
    const csp = await policyOf(HOSTED);
    const icons = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/';
    expect(directive(csp, 'style-src')).toEqual(expect.arrayContaining(["'unsafe-inline'", icons]));
    expect(directive(csp, 'font-src')).toContain(icons);
    expect(directive(csp, 'img-src')).toContain('https:');
    expect(directive(csp, 'media-src')).toContain('https:');
    expect(directive(csp, 'frame-src')).toContain('https:');
  });

  describe('localhost', () => {
    const allowsLocalhost = async (urls: WebappUrls) =>
      directive(await policyOf(urls), 'connect-src').includes('http://localhost:*');

    it('is allowed on a local stack, over plain HTTP', async () => {
      expect(await allowsLocalhost({ deploymentUrl: 'http://localhost:8080' })).toBe(true);
      expect(await policyOf({ deploymentUrl: 'http://localhost:8080' })).not.toContain('upgrade-insecure-requests');
    });

    it('is allowed when nothing is configured', async () => {
      expect(await allowsLocalhost({})).toBe(true);
    });

    it('is not allowed on a hosted build', async () => {
      expect(await allowsLocalhost(HOSTED)).toBe(false);
    });

    it('is not allowed on a hosted build whose runtime DEPLOYMENT_URL is unset', async () => {
      expect(await allowsLocalhost({ ...HOSTED, deploymentUrl: undefined })).toBe(false);
    });
  });

  describe('the walkthrough exception', () => {
    it.each(['/demo-agentic/', '/demo-agentic/index.html'])('allows inline script on %s', async (url) => {
      expect(directive(await policyOf(HOSTED, url), 'script-src')).toContain("'unsafe-inline'");
    });

    // Each of these falls back to the editor itself, where the key is.
    it.each([
      '/',
      '/demo-agentic',
      '/demo-agentic/nope',
      '/demo-agentic-x',
      '/demo-agentic/..%2Findex.html',
      '/DEMO-AGENTIC/',
    ])('allows no inline script on %s', async (url) => {
      expect(directive(await policyOf(HOSTED, url), 'script-src')).not.toContain("'unsafe-inline'");
    });
  });

  it('matches the webapp: index.html has no inline script', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../../../webapp/index.html'), 'utf8');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  });
});
