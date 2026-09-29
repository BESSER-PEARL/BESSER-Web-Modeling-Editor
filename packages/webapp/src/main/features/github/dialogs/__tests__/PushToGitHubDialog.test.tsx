import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('../../hooks/useGitHubStorage', () => ({
  useGitHubStorage: () => ({
    repositories,
    isLoading: false,
    fetchRepositories: vi.fn(),
    fetchBranches,
  }),
}));

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
