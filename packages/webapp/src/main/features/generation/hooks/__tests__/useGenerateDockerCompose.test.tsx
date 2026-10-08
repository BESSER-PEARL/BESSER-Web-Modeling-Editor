import type { ReactNode } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';

import { useGenerateDockerCompose } from '../useGenerateDockerCompose';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { useAppSelector } from '../../../../app/store/hooks';
import { createDefaultProject } from '../../../../shared/types/project';

const mockDownloadFile = vi.fn();

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/file-download/useFileDownload', () => ({
  useFileDownload: () => mockDownloadFile,
}));

vi.mock('../../../../app/store/hooks', () => ({
  useAppSelector: vi.fn(),
}));

const errorResponse = (status: number, detail: string) =>
  vi.fn().mockResolvedValue({ ok: false, status, json: vi.fn().mockResolvedValue({ detail }) });

const generate = async () => {
  const { result } = renderHook(() => useGenerateDockerCompose());
  await act(async () => {
    await result.current.generate();
  });
};

describe('useGenerateDockerCompose', () => {
  const project = createDefaultProject('My Project', '', '');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockReturnValue(project);
    vi.mocked(useAppSelector).mockReturnValue(project.diagrams.DeploymentDiagram[0]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts the project to the shared generation endpoint with the docker_compose generator', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['zip'])),
      headers: { get: () => 'attachment; filename="my_project-docker-compose.zip"' },
    });
    vi.stubGlobal('fetch', fetchMock);

    await generate();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/generate-output-from-project$/);
    const body = JSON.parse(String(init.body));
    expect(body.name).toBe('My_Project');
    expect(body.settings).toMatchObject({ generator: 'docker_compose', config: {} });
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'my_project-docker-compose.zip' }),
    );
    // The empty Deployment diagram links no agent.
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('No agent is linked'));
  });

  it('shows concise Governance DSL guidance for the matching backend 422 detail', async () => {
    const detail = "Invalid Governance DSL on merging gateway 'gw1': Unexpected token at line 3";
    vi.stubGlobal('fetch', errorResponse(422, detail));

    await generate();

    expect(console.error).toHaveBeenCalledWith('Invalid Governance DSL:', detail);
    const toastContent = vi.mocked(toast.error).mock.calls[0]?.[0] as ReactNode;
    render(<>{toastContent}</>);
    expect(screen.getByText('Invalid Governance DSL')).toBeInTheDocument();
    expect(
      screen.getByText('Check the governance policy on gateway “gw1”. See the browser console for details.'),
    ).toBeInTheDocument();
  });

  it('explains a missing Deployment diagram', async () => {
    vi.stubGlobal('fetch', errorResponse(400, 'DeploymentDiagram is required for the Docker Compose generator'));

    await generate();

    expect(toast.error).toHaveBeenCalledWith(
      'No Deployment diagram content found — add at least one element before generating.',
    );
  });

  it('preserves generic 422 details that are not Governance DSL errors', async () => {
    vi.stubGlobal('fetch', errorResponse(422, 'A different validation error'));

    await generate();

    expect(toast.error).toHaveBeenCalledWith('A different validation error');
  });
});
