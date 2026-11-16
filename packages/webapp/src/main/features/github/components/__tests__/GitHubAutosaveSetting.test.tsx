import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProjectGitHubLink, setProjectGitHubLink } from '../../../../shared/services/storage/projectGitHubLink';
import { setAutosaveStatus } from '../../autosave/autosaveStatus';
import { GitHubAutosaveSetting } from '../GitHubAutosaveSetting';

const auth = vi.hoisted(() => ({ isAuthenticated: true, isExpired: false, isNotInTab: false, githubSession: 'session' as string | null }));
vi.mock('../../../../shared/hooks/useGitHubAuth', () => ({ useGitHubAuth: () => auth }));
const stableProject = vi.hoisted(() => ({ currentProject: { id: 'p1', name: 'Library', diagrams: {} }, loadProject: vi.fn() }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => stableProject }));
vi.mock('../../../../app/store/hooks', () => ({ useAppDispatch: () => vi.fn() }));
const track = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/services/analytics/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/services/analytics/events')>()),
  track,
}));

const link = () => setProjectGitHubLink('p1', { owner: 'ana', repo: 'shop', branch: 'main' });

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
  Object.assign(auth, { isAuthenticated: true, githubSession: 'session' });
  act(() => setAutosaveStatus('p1', { phase: 'off' }));
});

describe('GitHubAutosaveSetting', () => {
  it('is hidden when the project is not linked to a repository', () => {
    render(<GitHubAutosaveSetting />);
    expect(screen.queryByTestId('github-autosave-setting')).not.toBeInTheDocument();
  });

  it('is off by default once linked, and turning it on is kept on the link', () => {
    link();
    render(<GitHubAutosaveSetting />);
    const toggle = screen.getByRole('checkbox', { name: /Autosave to GitHub/ });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/linked to ana\/shop on main/)).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(getProjectGitHubLink('p1')?.autoSave).toBe(true);
    expect(screen.getByRole('checkbox', { name: /Autosave to GitHub/ })).toBeChecked();
    expect(track).toHaveBeenCalledWith('settings_changed', { area: 'github', setting: 'autosave', value: true });

    fireEvent.click(screen.getByRole('checkbox', { name: /Autosave to GitHub/ }));
    expect(getProjectGitHubLink('p1')?.autoSave).toBeUndefined();
  });

  it('cannot be turned on without a GitHub session in this tab', () => {
    Object.assign(auth, { isAuthenticated: false, githubSession: null });
    setProjectGitHubLink('p1', { owner: 'ana', repo: 'shop', branch: 'main', autoSave: true });
    render(<GitHubAutosaveSetting />);
    const toggle = screen.getByRole('checkbox', { name: /Autosave to GitHub/ });
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/Connect GitHub in this tab/)).toBeInTheDocument();
  });

  it('shows how autosave stands, quietly', () => {
    setProjectGitHubLink('p1', { owner: 'ana', repo: 'shop', branch: 'main', autoSave: true });
    render(<GitHubAutosaveSetting />);
    act(() => setAutosaveStatus('p1', { phase: 'saving' }));
    expect(screen.getByTestId('github-autosave-status')).toHaveTextContent('Autosaving to GitHub…');
    act(() => setAutosaveStatus('p1', { phase: 'paused', pause: 'remote' }));
    expect(screen.getByTestId('github-autosave-status')).toHaveTextContent(/new commits on GitHub.*Get latest or Save and merge/);
    act(() => setAutosaveStatus('p1', { phase: 'error', retryAt: Date.now() + 60_000 }));
    expect(screen.getByTestId('github-autosave-status')).toHaveTextContent(/could not reach GitHub/);
    act(() => setAutosaveStatus('p1', { phase: 'idle', lastSavedAt: Date.now() }));
    expect(screen.getByTestId('github-autosave-status')).toHaveTextContent(/Autosaved to GitHub at/);
  });
});
