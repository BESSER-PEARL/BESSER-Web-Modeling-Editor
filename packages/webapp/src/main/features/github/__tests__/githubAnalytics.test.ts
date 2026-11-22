import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/api-client';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/services/analytics/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/services/analytics/events')>()),
  track,
}));

import { trackGitHubAction } from '../githubAnalytics';

beforeEach(() => track.mockClear());

describe('trackGitHubAction', () => {
  it('reports a completed action with what the result says', async () => {
    const result = await trackGitHubAction('save_model', async () => ({ status: 'merged', warnings: [] }), (r) => ({
      status: r.status,
      warnings_count: r.warnings.length,
    }));
    expect(result.status).toBe('merged');
    expect(track).toHaveBeenCalledWith('github_action_completed', { action: 'save_model', status: 'merged', warnings_count: 0 });
  });

  it('reports a failed action with its HTTP status and still throws it for the caller', async () => {
    const failure = new ApiError(403, 'Resource not accessible');
    await expect(trackGitHubAction('create_repo', () => Promise.reject(failure))).rejects.toBe(failure);
    expect(track).toHaveBeenCalledWith('github_action_failed', {
      action: 'create_repo',
      error_type: 'ApiError',
      http_status: 403,
      network_error: false,
    });
    expect(track).not.toHaveBeenCalledWith('github_action_completed', expect.anything());
  });
});
