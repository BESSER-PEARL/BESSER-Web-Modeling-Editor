import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const goLive = vi.fn();
const getSyncStatus = vi.fn();
vi.mock('../../../../shared/api/github', () => ({
  goLive: (...args: unknown[]) => goLive(...args),
  getSyncStatus: (...args: unknown[]) => getSyncStatus(...args),
}));

import { GoLiveDialog } from '../GoLiveDialog';
import { ApiError } from '../../../../shared/api/api-client';
import { getProjectGitHubLink, setProjectGitHubLink } from '../../../../shared/services/storage/projectGitHubLink';

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
  getSyncStatus.mockReset();
  localStorage.clear();
});

describe('GoLiveDialog — the link after Go live', () => {
  const ready = {
    commit_sha: 'c'.repeat(40), changed: true, render_deploy_url: 'r', backend_url: 'https://b.onrender.com',
    frontend_url: null, backend_dir: 'backend', frontend_dir: null, warnings: [],
  };

  it('moves the base to the deploy commit when the project was at the branch head (review repro)', async () => {
    // The badge said "1 new commit" right after Go live: its own commit.
    setProjectGitHubLink('p1', link);
    getSyncStatus.mockResolvedValue({ head_sha: link.baseCommitSha, commits_since: [], in_sync: true });
    goLive.mockResolvedValue(ready);
    renderDialog();
    await prepare();

    expect(getProjectGitHubLink('p1')).toMatchObject({ baseCommitSha: 'c'.repeat(40), liveUrl: 'https://b.onrender.com' });
  });

  it('keeps the base when the branch had newer commits, so they still show', async () => {
    setProjectGitHubLink('p1', link);
    getSyncStatus.mockResolvedValue({ head_sha: 'b'.repeat(40), commits_since: [{ sha: 'b'.repeat(40) }], in_sync: false });
    goLive.mockResolvedValue(ready);
    renderDialog();
    await prepare();

    expect(getProjectGitHubLink('p1')?.baseCommitSha).toBe(link.baseCommitSha);
  });

  it('reads the link from storage, not from a stale prop', async () => {
    // A save moved the base after the dialog opened; Go live must not put the old one back.
    const saved = 'd'.repeat(40);
    setProjectGitHubLink('p1', { ...link, baseCommitSha: saved, syncedModel: 'x' });
    getSyncStatus.mockResolvedValue({ head_sha: saved, commits_since: [], in_sync: true });
    goLive.mockResolvedValue(ready);
    renderDialog();
    await prepare();

    expect(getSyncStatus).toHaveBeenCalledWith('s', 'ana', 'room-booking', 'main', saved);
    expect(getProjectGitHubLink('p1')).toMatchObject({ baseCommitSha: 'c'.repeat(40), syncedModel: 'x' });
  });

  it('keeps the base when Go live committed nothing', async () => {
    setProjectGitHubLink('p1', link);
    getSyncStatus.mockResolvedValue({ head_sha: link.baseCommitSha, commits_since: [], in_sync: true });
    goLive.mockResolvedValue({ ...ready, changed: false, commit_sha: link.baseCommitSha });
    renderDialog();
    await prepare();

    expect(getProjectGitHubLink('p1')?.baseCommitSha).toBe(link.baseCommitSha);
  });
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
