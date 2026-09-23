import type { ReactNode } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';

import { useGenerateDockerCompose } from '../useGenerateDockerCompose';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { useAppSelector } from '../../../app/store/hooks';

const mockDownloadFile = vi.fn();

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../../../shared/services/file-download/useFileDownload', () => ({
  useFileDownload: () => mockDownloadFile,
}));

vi.mock('../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: {
    getCurrentProject: vi.fn(),
  },
}));

vi.mock('../../../shared/constants/constant', () => ({
  BACKEND_URL: 'http://backend.test',
}));

vi.mock('../../../app/store/hooks', () => ({
  useAppSelector: vi.fn(),
}));

describe('useGenerateDockerCompose', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ProjectStorageRepository.getCurrentProject).mockReturnValue({
      name: 'Project',
      diagrams: {},
      settings: {},
    } as any);
    vi.mocked(useAppSelector).mockReturnValue({ model: { elements: {} } } as any);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows concise Governance DSL guidance for the matching backend 422 detail', async () => {
    const detail = "Invalid Governance DSL on merging gateway 'gw1': Unexpected token at line 3";
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({ detail }),
      }),
    );

    const { result } = renderHook(() => useGenerateDockerCompose());
    await act(async () => {
      await result.current.generate();
    });

    expect(console.error).toHaveBeenCalledWith('Invalid Governance DSL:', detail);
    const toastContent = vi.mocked(toast.error).mock.calls[0]?.[0] as ReactNode;
    render(<>{toastContent}</>);
    expect(screen.getByText('Invalid Governance DSL')).toBeInTheDocument();
    expect(
      screen.getByText('Check the governance policy on gateway “gw1”. See the browser console for details.'),
    ).toBeInTheDocument();
  });

  it('preserves the existing DeploymentDiagram content guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ detail: 'Deployment diagram is required for the deployment' }),
      }),
    );

    const { result } = renderHook(() => useGenerateDockerCompose());
    await act(async () => {
      await result.current.generate();
    });

    expect(toast.error).toHaveBeenCalledWith(
      'No Deployment diagram content found — add at least one element before generating.',
    );
  });

  it('preserves generic 422 details that are not Governance DSL errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({ detail: 'A different validation error' }),
      }),
    );

    const { result } = renderHook(() => useGenerateDockerCompose());
    await act(async () => {
      await result.current.generate();
    });

    expect(toast.error).toHaveBeenCalledWith('A different validation error');
  });
});
