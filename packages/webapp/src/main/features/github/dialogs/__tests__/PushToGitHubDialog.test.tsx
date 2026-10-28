import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PushToGitHubDialog, type PushToGitHubDialogProps } from '../PushToGitHubDialog';
import type { SpecDrivenPushResult } from '../../hooks/useSpecDrivenGithubPush';

const repositories = [
  { id: 1, name: 'slow', full_name: 'me/slow', private: false, default_branch: 'main', topics: [] },
  { id: 2, name: 'fast', full_name: 'me/fast', private: false, default_branch: 'trunk', topics: [] },
];

const pendingBranches = new Map<string, (branches: string[]) => void>();
const listBranches = vi.fn(
  (_session: string, _owner: string, repo: string) =>
    new Promise<string[]>((resolve) => pendingBranches.set(repo, resolve)),
);
const listRepos = vi.fn(async () => repositories);

vi.mock('../../services/githubApi', () => ({
  listRepos: (...args: unknown[]) => listRepos(...(args as [])),
  listBranches: (...args: unknown[]) => listBranches(...(args as [string, string, string])),
}));

const baseProps = (): PushToGitHubDialogProps => ({
  open: true,
  runId: 'r1',
  projectName: 'Demo',
  linkedRepo: null,
  githubSession: 'session',
  isPushing: false,
  result: null,
  onOpenChange: () => {},
  onChangeRepo: () => {},
  push: vi.fn().mockResolvedValue({ ok: true }),
  openConflictPullRequest: vi.fn().mockResolvedValue(null),
});

const renderDialog = (overrides: Partial<PushToGitHubDialogProps> = {}) =>
  render(<PushToGitHubDialog {...baseProps()} {...overrides} />);

const result = (overrides: Partial<SpecDrivenPushResult>): SpecDrivenPushResult => ({
  success: true,
  repo_url: 'https://github.com/me/app',
  owner: 'me',
  repo_name: 'app',
  is_first_push: false,
  files_uploaded: 12,
  branch: 'main',
  commit_sha: 'c'.repeat(40),
  status: 'pushed',
  conflict_branch: null,
  pull_request_url: null,
  base_run_id: null,
  ...overrides,
});

beforeEach(() => {
  listRepos.mockReset();
  listRepos.mockImplementation(async () => repositories);
});

describe('PushToGitHubDialog — existing-repo branch picker', () => {
  it('ignores a branch list that arrives after the user picked another repo', async () => {
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /existing/i }));
    });
    const pickRepo = (name: string) => {
      fireEvent.keyDown(screen.getByLabelText('Repository'), { key: 'ArrowDown' });
      fireEvent.click(screen.getByRole('option', { name }));
    };
    pickRepo('me/slow');
    pickRepo('me/fast');

    // The fast repo answers first, then the slow repo's stale answer lands.
    await act(async () => pendingBranches.get('fast')!(['trunk', 'dev']));
    await act(async () => pendingBranches.get('slow')!(['main', 'feature-x']));

    const branchTrigger = screen.getByLabelText('Branch');
    expect(branchTrigger).toHaveTextContent('trunk');
    fireEvent.keyDown(branchTrigger, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['trunk', 'dev']);
  });
});

describe('PushToGitHubDialog — empty repository list', () => {
  afterEach(() => {
    listRepos.mockReset();
  });

  it('fetches once when the list comes back empty, then refetches only on Retry', async () => {
    listRepos.mockImplementation(async () => []);

    renderDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /existing/i }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(listRepos).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/No repositories loaded|github\.push\.noRepositories/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(listRepos).toHaveBeenCalledTimes(2);
  });

  it('marks the active Create/Existing toggle with aria-pressed', () => {
    renderDialog();
    const create = screen.getByRole('button', { name: /create new|github\.push\.createNew/i });
    const existing = screen.getByRole('button', { name: /existing/i });
    expect(create).toHaveAttribute('aria-pressed', 'true');
    expect(existing).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('PushToGitHubDialog — keyboard submit', () => {
  it('submits the form on Enter in the repository name field', async () => {
    const push = vi.fn().mockResolvedValue({ ok: true });
    renderDialog({ push });

    const nameInput = screen.getByLabelText(/Repository Name/);
    await act(async () => {
      fireEvent.submit(nameInput.closest('form')!);
    });
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ useExisting: false, repoName: 'demo' }));
  });
});

describe('PushToGitHubDialog — pushing to the linked repo', () => {
  const linkedRepo = { owner: 'me', repo: 'app', branch: 'main', baseCommitSha: 'a'.repeat(40) };

  it('can open a pull request instead of committing to the branch', async () => {
    const push = vi.fn().mockResolvedValue({ ok: true });
    renderDialog({ linkedRepo, push });

    fireEvent.click(screen.getByLabelText(/Open a pull request/));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Open a pull request/ }));
    });

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ useExisting: true, repoName: 'app', branch: 'main', pushMode: 'pull_request' }),
    );
  });

  it('says a merged push kept the commits made on GitHub', () => {
    renderDialog({ linkedRepo, result: result({ status: 'merged' }) });
    expect(screen.getByText(/Merged with the commits made on GitHub/)).toBeInTheDocument();
  });

  it('offers a pull request when GitHub could not merge the push', async () => {
    const openConflictPullRequest = vi.fn().mockResolvedValue(null);
    renderDialog({
      linkedRepo,
      result: result({ status: 'conflict', conflict_branch: 'besser/sync-ccccccc' }),
      openConflictPullRequest,
    });

    expect(screen.getByText(/besser\/sync-ccccccc/)).toBeInTheDocument();
    expect(screen.getByText(/nothing was overwritten/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Open a pull request to merge it/ }));
    });
    expect(openConflictPullRequest).toHaveBeenCalledTimes(1);
  });

  it('shows the warnings the push returned', () => {
    renderDialog({
      linkedRepo,
      result: result({ warnings: ['This app can no longer be deployed as before (render.yaml).'] }),
    });
    expect(screen.getByText(/can no longer be deployed as before/)).toBeInTheDocument();
  });

  it('offers the repository picker when the linked repository is gone', async () => {
    const onChangeRepo = vi.fn();
    const push = vi.fn().mockResolvedValue({ ok: false, code: 'repo_missing', message: 'This repository no longer exists' });
    renderDialog({ linkedRepo, push, onChangeRepo });

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
    });

    expect(onChangeRepo).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/This repository no longer exists/)).toBeInTheDocument();
  });
});
