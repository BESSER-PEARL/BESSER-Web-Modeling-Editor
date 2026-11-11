import { afterEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn(async (_path: string, _body: Record<string, unknown>, _options?: unknown) => ({}));
vi.mock('../api-client', () => ({ apiClient: { post: (path: string, body: Record<string, unknown>, options?: unknown) => post(path, body, options) } }));

import { importRepoAsRun } from '../github';

afterEach(() => {
  sessionStorage.clear();
  post.mockClear();
});

describe('importRepoAsRun', () => {
  it('sends the demo secret from a demo tab, so the demo model reads the repo', async () => {
    sessionStorage.setItem('besser-demo-token', 'demo-secret-1234');
    await importRepoAsRun('s', 'me', 'shop');
    expect(post.mock.calls[0][1]).toMatchObject({ owner: 'me', repo: 'shop', demo_token: 'demo-secret-1234' });
  });

  it('sends no demo secret from an ordinary tab', async () => {
    await importRepoAsRun('s', 'me', 'shop');
    expect(post.mock.calls[0][1]).toMatchObject({ demo_token: undefined });
  });
});
