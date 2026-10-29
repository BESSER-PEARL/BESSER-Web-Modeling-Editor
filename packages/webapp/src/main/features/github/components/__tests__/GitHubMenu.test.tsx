import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { RepoSyncState } from '../../hooks/useRepoSync';

const sync = {
  link: null as null | { owner: string; repo: string; branch: string },
  state: 'unlinked' as RepoSyncState,
  status: null as null | { head_sha: string; commits_since: unknown[]; in_sync: boolean },
  hasLocalChanges: false,
  githubSession: 'session-token-123',
  refresh: vi.fn(async () => undefined),
  pull: vi.fn(async () => undefined),
  pullInto: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  linkTo: vi.fn(),
  unlink: vi.fn(),
  markSynced: vi.fn(),
};
vi.mock('../../hooks/useRepoSync', () => ({ useRepoSync: () => sync }));
vi.mock('../../hooks/useFlushEditorModel', () => ({ useFlushEditorModel: () => () => undefined }));
vi.mock('../../../../app/hooks/useProject', () => ({
  useProject: () => ({ currentProject: { id: 'p1', name: 'Library', description: '' } }),
}));
const globalConfirm = vi.fn(async () => true);
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({
  globalConfirm: (...args: unknown[]) => globalConfirm(...(args as [])),
}));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const createRepoForProject = vi.fn();
vi.mock('../../../../shared/api/github', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/api/github')>()),
  createRepoForProject: (...args: unknown[]) => createRepoForProject(...args),
}));
const storedProject = { id: 'p1', name: 'Library', description: '', diagrams: {} };
vi.mock('../../../../shared/services/storage/ProjectStorageRepository', () => ({
  ProjectStorageRepository: { loadProject: () => storedProject },
}));
vi.mock('../../../../shared/utils/projectExportUtils', () => ({ buildProjectExportEnvelope: () => ({}) }));
// The browser itself is covered by RepoBrowser.test; here it only hands back a choice.
const repoChoice = { owner: 'ana', repo: 'shop', branch: 'main', summary: { has_model: true, project_name: 'Shop', head_sha: 'c'.repeat(40) } };
vi.mock('../../../../shared/components/github/RepoBrowser', () => ({
  RepoBrowser: ({ onAction }: { onAction: (choice: unknown) => void }) => (
    <button type="button" onClick={() => onAction(repoChoice)}>
      pick ana/shop
    </button>
  ),
}));

import { GitHubMenu } from '../GitHubMenu';
import { OPEN_GITHUB_PANEL_EVENT } from '../../../../shared/api/github';

const commit = { sha: 'b'.repeat(40), message: 'Fix', author: 'Ana', date: '', html_url: '', origin: null };
const onLogin = vi.fn();
const onLogout = vi.fn();

const renderMenu = (isAuthenticated = true) =>
  render(
    <TooltipProvider>
      <GitHubMenu
        outlineButtonClass=""
        isAuthenticated={isAuthenticated}
        username="ana"
        githubLoading={false}
        onLogin={onLogin}
        onLogout={onLogout}
      />
    </TooltipProvider>,
  );

const linkAs = (state: RepoSyncState, behind = 0, hasLocalChanges = false) => {
  sync.link = { owner: 'ana', repo: 'library-app', branch: 'main' };
  sync.state = state;
  sync.status = { head_sha: 'b'.repeat(40), commits_since: Array.from({ length: behind }, () => commit), in_sync: behind === 0 };
  sync.hasLocalChanges = hasLocalChanges;
};

const openMenu = () => fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });

beforeEach(() => {
  vi.clearAllMocks();
  sync.link = null;
  sync.state = 'unlinked';
  sync.status = null;
  sync.hasLocalChanges = false;
});

describe('GitHubMenu', () => {
  it('offers Connect GitHub when signed out, and the open event starts sign-in', () => {
    renderMenu(false);

    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_GITHUB_PANEL_EVENT));
    });
    expect(onLogin).toHaveBeenCalledTimes(2);
  });

  it('says "Link to GitHub" and offers create or link when the project has no repository', () => {
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'Link this project to a GitHub repository' });
    expect(trigger).toHaveTextContent('Link to GitHub');
    openMenu();
    expect(screen.getByRole('menuitem', { name: 'Create a repository for this project' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Link an existing repository…' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Save to GitHub…' })).toBeNull();
    expect(screen.getByText('Signed in as ana')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('shows the linked repository with its state, and the linked actions', () => {
    linkAs('in-sync');
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'ana/library-app: in sync with GitHub' });
    expect(trigger).toHaveTextContent('library-app');
    expect(screen.getByTestId('repo-state-dot')).toHaveClass('bg-success');
    openMenu();
    expect(sync.refresh).toHaveBeenCalled();
    expect(screen.getByText('In sync with GitHub')).toBeInTheDocument();
    for (const name of ['Save to GitHub…', 'History…', 'Change repository…', 'Unlink', 'Sign Out']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('menuitem', { name: 'Open on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/ana/library-app/tree/main',
    );
    // Nothing new on GitHub: no pull.
    expect(screen.queryByRole('menuitem', { name: 'Get latest' })).toBeNull();
  });

  it('offers Get latest when GitHub is ahead, and confirms before discarding local changes', async () => {
    linkAs('diverged', 2, true);
    globalConfirm.mockResolvedValueOnce(false);
    renderMenu();

    openMenu();
    expect(screen.getByText('Saving merges both versions. Get latest takes the GitHub version instead.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Get latest' }));
    await waitFor(() => expect(globalConfirm).toHaveBeenCalledTimes(1));
    expect(sync.pull).not.toHaveBeenCalled();
  });

  it('pulls straight away when behind without local changes', async () => {
    linkAs('behind', 1);
    renderMenu();

    expect(screen.getByRole('button', { name: 'ana/library-app: 1 new commit on GitHub' })).toBeInTheDocument();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Get latest' }));
    await waitFor(() => expect(sync.pull).toHaveBeenCalledTimes(1));
    expect(globalConfirm).not.toHaveBeenCalled();
  });

  it('saves with a default message and offers a pull request on a conflict', async () => {
    linkAs('local-changes', 0, true);
    sync.save.mockResolvedValueOnce({ success: true, commit_sha: '', message: '', status: 'conflict', conflict_branch: 'besser/save-1' });
    renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save to GitHub…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sync.save).toHaveBeenCalledWith('Update the model from the BESSER editor'));
    expect(await screen.findByRole('alert')).toHaveTextContent('besser/save-1');
    expect(screen.getByRole('button', { name: 'Open a pull request to merge it' })).toBeInTheDocument();
  });

  it('unlinks only after the user confirms', async () => {
    linkAs('in-sync');
    renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unlink' }));
    await waitFor(() => expect(sync.unlink).toHaveBeenCalledTimes(1));
    expect(globalConfirm).toHaveBeenCalledTimes(1);
  });

  it('opens from the open event when signed in', () => {
    linkAs('in-sync');
    renderMenu();

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_GITHUB_PANEL_EVENT));
    });
    expect(screen.getByRole('menuitem', { name: 'Save to GitHub…' })).toBeInTheDocument();
    // An open from the event re-checks the repo just like a click does.
    expect(sync.refresh).toHaveBeenCalled();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('creates a repository named after the project and marks the project synced', async () => {
    createRepoForProject.mockResolvedValueOnce({
      owner: 'ana',
      repo_url: 'https://github.com/ana/library',
      branch: 'main',
      commit_sha: 'd'.repeat(40),
    });
    renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create a repository for this project' }));
    const nameInput = await screen.findByDisplayValue('library');
    fireEvent.submit(nameInput.closest('form') ?? nameInput);
    await waitFor(() => expect(createRepoForProject).toHaveBeenCalledTimes(1));
    expect(createRepoForProject.mock.calls[0][1]).toMatchObject({ repo_name: 'library', is_private: true, project_data: storedProject });
    await waitFor(() =>
      expect(sync.markSynced).toHaveBeenCalledWith({ owner: 'ana', repo: 'library', branch: 'main' }, storedProject, 'd'.repeat(40)),
    );
  });

  it('loads the model of a repository that already holds one when the user chooses to', async () => {
    globalConfirm.mockResolvedValueOnce(true);
    sync.pullInto.mockResolvedValueOnce(undefined);
    renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Link an existing repository…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'pick ana/shop' }));
    await waitFor(() => expect(sync.pullInto).toHaveBeenCalledWith({ owner: 'ana', repo: 'shop', branch: 'main' }, 'p1'));
    expect(sync.linkTo).not.toHaveBeenCalled();
  });

  it('keeps the local model and links on top of the repository head when the user declines', async () => {
    globalConfirm.mockResolvedValueOnce(false);
    renderMenu();

    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Link an existing repository…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'pick ana/shop' }));
    await waitFor(() => expect(sync.linkTo).toHaveBeenCalledWith('ana', 'shop', 'main', 'c'.repeat(40)));
    expect(sync.pullInto).not.toHaveBeenCalled();
  });

  it('offers Reconnect instead of Save when the GitHub session expired', () => {
    linkAs('reconnect');
    renderMenu();
    openMenu();

    expect(screen.getByText('GitHub session expired: reconnect')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Save to GitHub…' })).toHaveAttribute('data-disabled');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reconnect GitHub' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('offers to link another repository when the branch or repository is gone', () => {
    linkAs('missing');
    renderMenu();
    openMenu();

    expect(screen.getByText(/The branch main or the repository was deleted/)).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Save to GitHub…' })).toHaveAttribute('data-disabled');
    expect(screen.getByRole('menuitem', { name: 'Link an existing repository…' })).toBeInTheDocument();
  });
});
