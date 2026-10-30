import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const loadProject = vi.fn(async () => undefined);
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => ({ loadProject }) }));
vi.mock('../../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../../../shared/hooks/useGitHubAuth', () => ({
  useGitHubAuth: () => ({ isAuthenticated: true, isChecking: false, githubSession: 'session', login: vi.fn() }),
}));
vi.mock('../../../../shared/components/github/RepoBrowser', () => ({
  RepoBrowser: ({ onAction }: { onAction: (choice: unknown) => void }) => (
    <button type="button" onClick={() => onAction({ owner: 'ana', repo: 'shop', branch: 'main' })}>
      pick ana/shop
    </button>
  ),
}));
const continueFromGithubRepo = vi.fn();
vi.mock('../../../../shared/services/github/continueFromGithub', () => ({
  continueFromGithubRepo: (...args: unknown[]) => continueFromGithubRepo(...args),
  describeOpenedRepo: () => 'Opened ana/shop.',
}));

import { StartFromRepoDialog } from '../StartFromRepoDialog';

afterEach(cleanup);

describe('StartFromRepoDialog', () => {
  it('opens the picked repository, then hands its summary to the caller and closes', async () => {
    continueFromGithubRepo.mockResolvedValue({ ok: true, projectId: 'p2', owner: 'ana', repo: 'shop' });
    const onRepoOpened = vi.fn();
    const onOpenChange = vi.fn();
    render(<StartFromRepoDialog open onOpenChange={onOpenChange} onRepoOpened={onRepoOpened} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'pick ana/shop' }));
    });

    await waitFor(() => expect(onRepoOpened).toHaveBeenCalledWith('Opened ana/shop.'));
    expect(loadProject).toHaveBeenCalledWith('p2');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
