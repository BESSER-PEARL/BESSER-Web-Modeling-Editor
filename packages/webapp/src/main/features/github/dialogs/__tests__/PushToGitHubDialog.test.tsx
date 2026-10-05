import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PushToGitHubDialog } from '../PushToGitHubDialog';

const repositories = [
  { id: 1, name: 'slow', full_name: 'me/slow', private: false, default_branch: 'main' },
  { id: 2, name: 'fast', full_name: 'me/fast', private: false, default_branch: 'trunk' },
];

const pendingBranches = new Map<string, (branches: string[]) => void>();
const fetchBranches = vi.fn(
  (_session: string, _owner: string, repo: string) =>
    new Promise<string[]>((resolve) => pendingBranches.set(repo, resolve)),
);

const defaultStorage = () => ({
  repositories,
  isLoading: false,
  fetchRepositories: vi.fn(),
  fetchBranches,
});
let useStorageImpl: () => unknown = defaultStorage;

vi.mock('../../hooks/useGitHubStorage', () => ({
  useGitHubStorage: () => useStorageImpl(),
}));

const renderDialog = () =>
  render(
    <PushToGitHubDialog
      open
      runId="r1"
      projectName="Demo"
      linkedRepo={null}
      githubSession="session"
      isPushing={false}
      result={null}
      onOpenChange={() => {}}
      onChangeRepo={() => {}}
      push={vi.fn().mockResolvedValue({ ok: true })}
    />,
  );

describe('PushToGitHubDialog — existing-repo branch picker', () => {
  it('ignores a branch list that arrives after the user picked another repo', async () => {
    const push = vi.fn().mockResolvedValue({ ok: true });
    render(
      <PushToGitHubDialog
        open
        runId="r1"
        projectName="Demo"
        linkedRepo={null}
        githubSession="session"
        isPushing={false}
        result={null}
        onOpenChange={() => {}}
        onChangeRepo={() => {}}
        push={push}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /existing/i }));
    const repoSelect = screen.getByLabelText('Repository');
    fireEvent.change(repoSelect, { target: { value: 'me/slow' } });
    fireEvent.change(repoSelect, { target: { value: 'me/fast' } });

    // The fast repo answers first, then the slow repo's stale answer lands.
    await act(async () => pendingBranches.get('fast')!(['trunk', 'dev']));
    await act(async () => pendingBranches.get('slow')!(['main', 'feature-x']));

    const branchSelect = screen.getByLabelText('Branch') as HTMLSelectElement;
    const options = Array.from(branchSelect.options).map((option) => option.value);
    expect(options).toEqual(['trunk', 'dev']);
    expect(branchSelect.value).toBe('trunk');
  });
});

describe('PushToGitHubDialog — empty repository list', () => {
  afterEach(() => {
    useStorageImpl = defaultStorage;
  });

  it('fetches once when the list comes back empty, then refetches only on Retry', async () => {
    // A failed fetch resolves to [] and flips isLoading true -> false, which
    // used to re-trigger the auto-load effect forever.
    const fetchRepositories = vi.fn();
    useStorageImpl = () => {
      const [isLoading, setIsLoading] = React.useState(false);
      fetchRepositories.mockImplementation(async () => {
        setIsLoading(true);
        await Promise.resolve();
        setIsLoading(false);
        return [];
      });
      return { repositories: [], isLoading, fetchRepositories, fetchBranches };
    };

    renderDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /existing/i }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchRepositories).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/No repositories loaded/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(fetchRepositories).toHaveBeenCalledTimes(2);
  });

  it('marks the active Create/Existing toggle with aria-pressed', () => {
    renderDialog();
    const create = screen.getByRole('button', { name: /create new repo/i });
    const existing = screen.getByRole('button', { name: /existing/i });
    expect(create).toHaveAttribute('aria-pressed', 'true');
    expect(existing).toHaveAttribute('aria-pressed', 'false');
  });
});
