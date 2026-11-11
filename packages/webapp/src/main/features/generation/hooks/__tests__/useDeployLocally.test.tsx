/**
 * A failed local deploy turns its loading toast into an error toast. That toast
 * must look as before, and the caught error must reach Sentry like any other
 * reported failure (4xx answers stay toast-only).
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import type { ApollonEditor } from '@besser/wme';

import { useDeployLocally } from '../useDeployLocally';
import { deployApp } from '../../../../shared/api/generation';
import { validateDiagram } from '../../../../shared/services/validation/validateDiagram';
import { ApiError } from '../../../../shared/api/api-client';
import { globalConfirm } from '../../../../shared/services/confirm/globalConfirm';

const captureException = vi.fn();
const captureEvent = vi.hoisted(() => vi.fn());

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), loading: vi.fn(() => 'deploy-toast'), update: vi.fn() },
}));
vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({
  getSentry: () => ({ captureException }),
  captureEvent,
}));
vi.mock('../../../../shared/services/validation/validateDiagram', () => ({
  validateDiagram: vi.fn(async () => ({ isValid: true })),
}));
vi.mock('../../../../shared/api/generation', () => ({ deployApp: vi.fn() }));
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn() }));

const editor = { model: { type: 'ClassDiagram', elements: {} } } as unknown as ApollonEditor;

const deploy = async () => {
  const { result } = renderHook(() => useDeployLocally());
  await act(async () => {
    await result.current(editor, 'django', 'Shop');
  });
};

beforeEach(() => {
  vi.mocked(toast.update).mockClear();
  vi.mocked(toast.error).mockClear();
  captureException.mockClear();
  captureEvent.mockClear();
});

const deployEvents = () => captureEvent.mock.calls.filter(([event]) => event.startsWith('local_deploy_'));

describe('useDeployLocally analytics', () => {
  it('reports a finished deploy with its duration', async () => {
    vi.mocked(deployApp).mockResolvedValueOnce(undefined as never);
    await deploy();
    expect(deployEvents()).toEqual([['local_deploy_succeeded', { duration_ms: expect.any(Number) }]]);
  });

  it("reports a failed deploy with the error's kind and status, never its detail", async () => {
    vi.mocked(deployApp).mockRejectedValueOnce(new ApiError(500, 'Request failed', 'docker compose up failed'));
    await deploy();
    expect(deployEvents()).toEqual([
      [
        'local_deploy_failed',
        { duration_ms: expect.any(Number), error_type: 'ApiError', http_status: 500, network_error: false },
      ],
    ]);
  });

  it('blocks on an invalid model as a validation refusal', async () => {
    vi.mocked(validateDiagram).mockResolvedValueOnce({ isValid: false, errors: ['Class has no name'] } as never);
    await deploy();
    expect(deployEvents()).toEqual([['local_deploy_blocked', { generator_type: 'django', reason: 'validation' }]]);
  });

  it('blocks on a validation request that failed as a request failure, not an invalid model', async () => {
    vi.mocked(validateDiagram).mockResolvedValueOnce({
      isValid: false,
      errors: ['Validation timed out'],
      failure: new DOMException('timed out', 'TimeoutError'),
    } as never);
    await deploy();
    expect(deployEvents()).toEqual([['local_deploy_blocked', { generator_type: 'django', reason: 'request' }]]);
  });
});

describe('useDeployLocally with validation warnings', () => {
  it('does not deploy when the user chooses to fix the warnings first', async () => {
    vi.mocked(deployApp).mockClear();
    vi.mocked(validateDiagram).mockResolvedValueOnce({ isValid: true, errors: [], warnings: ['A is unused'] } as never);
    vi.mocked(globalConfirm).mockResolvedValueOnce(false);
    await deploy();
    expect(deployApp).not.toHaveBeenCalled();
    expect(deployEvents()).toEqual([['local_deploy_blocked', { generator_type: 'django', reason: 'warnings_declined' }]]);
  });

  it('deploys when the user chooses to go ahead', async () => {
    vi.mocked(deployApp).mockClear();
    vi.mocked(validateDiagram).mockResolvedValueOnce({ isValid: true, errors: [], warnings: ['A is unused'] } as never);
    vi.mocked(globalConfirm).mockResolvedValueOnce(true);
    vi.mocked(deployApp).mockResolvedValueOnce(undefined as never);
    await deploy();
    expect(deployApp).toHaveBeenCalledTimes(1);
  });
});

describe('useDeployLocally failures', () => {
  it("shows the server's detail of a 500 and reports the error", async () => {
    const error = new ApiError(500, 'Request failed', 'docker compose up failed');
    vi.mocked(deployApp).mockRejectedValueOnce(error);
    await deploy();

    expect(vi.mocked(toast.update).mock.calls).toEqual([
      ['deploy-toast', { render: 'docker compose up failed', type: 'error', isLoading: false, autoClose: 5000 }],
    ]);
    expect(toast.error).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledWith(error, { tags: { handled: 'reportError' } });
  });

  it('shows the status of a 4xx without reporting it', async () => {
    vi.mocked(deployApp).mockRejectedValueOnce(new ApiError(422, 'Unprocessable'));
    await deploy();

    expect(vi.mocked(toast.update).mock.calls).toEqual([
      ['deploy-toast', { render: 'HTTP error! status: 422', type: 'error', isLoading: false, autoClose: 5000 }],
    ]);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('shows the message of any other error and reports it', async () => {
    const error = new Error('Docker is not running');
    vi.mocked(deployApp).mockRejectedValueOnce(error);
    await deploy();

    expect(vi.mocked(toast.update).mock.calls).toEqual([
      ['deploy-toast', { render: 'Docker is not running', type: 'error', isLoading: false, autoClose: 5000 }],
    ]);
    expect(captureException).toHaveBeenCalledWith(error, { tags: { handled: 'reportError' } });
  });
});
