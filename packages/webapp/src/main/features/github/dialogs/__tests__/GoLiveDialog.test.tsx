import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const goLive = vi.fn();
vi.mock('../../services/githubApi', () => ({
  goLive: (...args: unknown[]) => goLive(...args),
}));

import { GoLiveDialog } from '../GoLiveDialog';
import { ApiError } from '../../../../shared/api/api-client';
import { getProjectGitHubLink } from '../../../../shared/services/storage/projectGitHubLink';

const link = { owner: 'ana', repo: 'room-booking', branch: 'main', baseCommitSha: 'a'.repeat(40) };

const renderDialog = (onUseClassicDeploy = vi.fn()) => {
  render(
    <GoLiveDialog
      open
      projectId="p1"
      link={link}
      githubSession="s"
      onOpenChange={() => {}}
      onUseClassicDeploy={onUseClassicDeploy}
    />,
  );
  return onUseClassicDeploy;
};

const prepare = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Prepare ana\/room-booking/ }));
  });
};

afterEach(() => {
  goLive.mockReset();
  localStorage.clear();
});

describe('GoLiveDialog', () => {
  it("prepares the project's own repo and hands over to Render", async () => {
    goLive.mockResolvedValue({
      commit_sha: 'c'.repeat(40),
      changed: true,
      render_deploy_url: 'https://render.com/deploy?repo=https://github.com/ana/room-booking',
      backend_url: 'https://room-booking-backend-abc123.onrender.com',
      frontend_url: 'https://room-booking-frontend-abc123.onrender.com',
      backend_dir: 'web_app/backend',
      frontend_dir: 'web_app/frontend',
      warnings: ['The frontend never reads VITE_API_URL.'],
    });
    renderDialog();

    await prepare();

    expect(goLive).toHaveBeenCalledWith('s', 'ana', 'room-booking', 'main');
    expect(screen.getByRole('link', { name: /Open Render/ })).toHaveAttribute(
      'href',
      'https://render.com/deploy?repo=https://github.com/ana/room-booking',
    );
    expect(screen.getByText('https://room-booking-frontend-abc123.onrender.com')).toBeInTheDocument();
    expect(screen.getByText('The frontend never reads VITE_API_URL.')).toBeInTheDocument();
    expect(getProjectGitHubLink('p1')?.liveUrl).toBe('https://room-booking-frontend-abc123.onrender.com');
  });

  it('explains why a repo cannot go live and offers the classic deploy', async () => {
    goLive.mockRejectedValue(new ApiError(422, 'Go live supports apps with a FastAPI backend for now.'));
    const onUseClassicDeploy = renderDialog();

    await prepare();

    expect(screen.getByRole('alert')).toHaveTextContent('Go live supports apps with a FastAPI backend for now.');
    fireEvent.click(screen.getByRole('button', { name: 'Use the classic deploy' }));
    expect(onUseClassicDeploy).toHaveBeenCalledTimes(1);
  });
});
