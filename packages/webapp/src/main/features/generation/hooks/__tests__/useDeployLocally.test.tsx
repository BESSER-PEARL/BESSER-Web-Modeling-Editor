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
import { ApiError } from '../../../../shared/api/api-client';

const captureException = vi.fn();

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), loading: vi.fn(() => 'deploy-toast'), update: vi.fn() },
}));
vi.mock('../../../../shared/services/analytics/lazy-analytics', () => ({ getSentry: () => ({ captureException }) }));
vi.mock('../../../../shared/services/validation/validateDiagram', () => ({
  validateDiagram: vi.fn(async () => ({ isValid: true })),
}));
vi.mock('../../../../shared/api/generation', () => ({ deployApp: vi.fn() }));

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
