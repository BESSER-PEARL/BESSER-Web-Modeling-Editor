/**
 * A dev build (the mode tests run in) talks to the local backend unless
 * `VITE_DEV_BACKEND_URL` names another one, as the BESSER Lab preview does.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const loadConstants = async () => {
  vi.resetModules();
  return import('../constant');
};

describe('backend address of a dev build', () => {
  it('is the local backend by default', async () => {
    vi.stubEnv('VITE_DEV_BACKEND_URL', '');

    const { BACKEND_URL, LAB_MESSAGE_ENDPOINT } = await loadConstants();

    expect(import.meta.env.DEV).toBe(true);
    expect(BACKEND_URL).toBe('http://localhost:9000/besser_api');
    expect(LAB_MESSAGE_ENDPOINT).toBe('http://localhost:9000/besser_api/lab/message');
  });

  it('follows VITE_DEV_BACKEND_URL, and so do the endpoints built on it', async () => {
    vi.stubEnv('VITE_DEV_BACKEND_URL', 'https://lab.example.org/besser_api');

    const { BACKEND_URL, LAB_MESSAGE_ENDPOINT, SMART_GEN_ENDPOINT } = await loadConstants();

    expect(BACKEND_URL).toBe('https://lab.example.org/besser_api');
    expect(LAB_MESSAGE_ENDPOINT).toBe('https://lab.example.org/besser_api/lab/message');
    expect(SMART_GEN_ENDPOINT).toBe('https://lab.example.org/besser_api/spec-driven/generate');
  });
});
