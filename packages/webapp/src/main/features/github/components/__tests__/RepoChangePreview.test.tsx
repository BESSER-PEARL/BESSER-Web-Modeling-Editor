import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepoSyncState } from '../../hooks/useRepoSync';

const HEAD = 'b'.repeat(40);
const BASE = 'a'.repeat(40);
const commit = { sha: HEAD, message: 'Add Spa', author: 'Ben Smith', author_login: 'ben', is_merge: false, date: '', html_url: '', origin: 'editor' };
const sync = {
  link: { owner: 'ana', repo: 'grand-hotel', branch: 'main', baseCommitSha: BASE },
  state: 'behind' as RepoSyncState,
  status: { head_sha: HEAD, commits_since: [commit], in_sync: false, pending: null },
  hasLocalChanges: false,
  githubSession: 'session',
  pull: vi.fn(async () => undefined),
};
vi.mock('../../hooks/useRepoSync', () => ({ useRepoSync: () => sync }));

const switchDiagramType = vi.fn();
const project = (elements: Record<string, unknown>) => ({
  id: 'p1',
  currentDiagramType: 'ClassDiagram',
  currentDiagramIndices: { ClassDiagram: 0 },
  diagrams: { ClassDiagram: [{ id: 'd1', model: { elements, relationships: {} } }] },
});
const envelope = (elements: Record<string, unknown>) => ({
  version: '2.0.0',
  project: { ...project(elements), type: 'Project', name: 'Hotel', schemaVersion: 3 },
});
const room = { type: 'Class', name: 'Room', bounds: { x: 0, y: 0, width: 200, height: 100 } };
const current = { currentProject: project({ room }), switchDiagramType };
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => current }));

const loadModelAtCommit = vi.fn();
vi.mock('../../../../shared/api/github', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../shared/api/github')>()),
  loadModelAtCommit: (...args: unknown[]) => loadModelAtCommit(...args),
}));
vi.mock('@besser/wme', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@besser/wme')>()),
  ApollonEditor: { exportModelAsSvg: vi.fn(async () => ({ svg: '<svg></svg>', clip: { x: 0, y: 0, width: 10, height: 10 } })) },
}));
const reportError = vi.fn();
vi.mock('../../../../shared/services/errors/reportError', () => ({ reportError: (...args: unknown[]) => reportError(...args) }));
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn(async () => true) }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn() } }));

import { ApiError } from '../../../../shared/api/api-client';
import { OPEN_GITHUB_SAVE_EVENT } from '../../../../shared/api/github';
import { closeRepoChangePreview, openRepoChangePreview } from '../../hooks/useRepoChangePreview';
import { RepoChangePreview } from '../RepoChangePreview';

const spa = { type: 'Class', name: 'Spa', bounds: { x: 300, y: 0, width: 200, height: 100 } };
const oldClass = { type: 'Class', name: 'Old', bounds: { x: 0, y: 200, width: 200, height: 100 } };

const showPreview = async () => {
  render(<RepoChangePreview />);
  act(() => openRepoChangePreview());
  await screen.findByText(/Your model has not changed/);
};

beforeEach(() => {
  vi.clearAllMocks();
  act(() => closeRepoChangePreview());
  sync.state = 'behind';
  sync.hasLocalChanges = false;
  current.currentProject = project({ room });
  loadModelAtCommit.mockImplementation(async (_session, _owner, _repo, sha) => ({
    // As the endpoint answers: the saved file, an envelope around the project.
    project: envelope(sha === HEAD ? { room, spa } : { room, old: oldClass }),
  }));
});

describe('RepoChangePreview', () => {
  it('stays away until asked', () => {
    render(<RepoChangePreview />);
    expect(screen.queryByRole('region')).toBeNull();
    expect(loadModelAtCommit).not.toHaveBeenCalled();
  });

  it('says what changed between the last sync and the head, and who did it', async () => {
    await showPreview();

    expect(loadModelAtCommit).toHaveBeenCalledWith('session', 'ana', 'grand-hotel', HEAD, undefined);
    expect(loadModelAtCommit).toHaveBeenCalledWith('session', 'ana', 'grand-hotel', BASE, undefined);
    expect(screen.getByText('@ben added Spa')).toBeInTheDocument();
    expect(screen.getByText('@ben removed Old')).toBeInTheDocument();
  });

  it('leaves the local model alone', async () => {
    const before = JSON.stringify(current.currentProject);
    await showPreview();
    expect(JSON.stringify(current.currentProject)).toBe(before);
  });

  it('takes the change in on Get latest', async () => {
    await showPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Get latest' }));
    await waitFor(() => expect(sync.pull).toHaveBeenCalledTimes(1));
  });

  it('asks for a merge, not a replacement, when there are unsaved edits', async () => {
    sync.hasLocalChanges = true;
    sync.state = 'diverged';
    const opened = vi.fn();
    window.addEventListener(OPEN_GITHUB_SAVE_EVENT, opened);
    await showPreview();

    fireEvent.click(screen.getByRole('button', { name: 'Save and merge' }));

    expect(opened).toHaveBeenCalledTimes(1);
    expect(sync.pull).not.toHaveBeenCalled();
    window.removeEventListener(OPEN_GITHUB_SAVE_EVENT, opened);
  });

  it('closes on Escape and on the close button', async () => {
    await showPreview();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region')).toBeNull();

    act(() => openRepoChangePreview());
    await screen.findByText(/Your model has not changed/);
    fireEvent.click(screen.getByRole('button', { name: 'Close the preview' }));
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('closes by itself once the project is in sync', async () => {
    const { rerender } = render(<RepoChangePreview />);
    act(() => openRepoChangePreview());
    await screen.findByText(/Your model has not changed/);

    sync.state = 'in-sync';
    rerender(<RepoChangePreview />);

    await waitFor(() => expect(screen.queryByRole('region')).toBeNull());
  });

  it('says so when the class diagrams are the same', async () => {
    loadModelAtCommit.mockImplementation(async () => ({ project: envelope({ room }) }));
    render(<RepoChangePreview />);
    act(() => openRepoChangePreview());

    expect(await screen.findByText(/The class diagrams are the same/)).toBeInTheDocument();
  });

  it('opens the class diagram when the user is on another editor', async () => {
    current.currentProject = { ...project({ room }), currentDiagramType: 'GUINoCodeDiagram' };
    await showPreview();
    expect(switchDiagramType).toHaveBeenCalledWith('ClassDiagram');
  });

  it('does not read a failed older version as "no model"', async () => {
    // Found in review: a 502 here made every class in the model look newly added by Ben.
    loadModelAtCommit.mockImplementation(async (_session, _owner, _repo, sha) => {
      if (sha === BASE) throw new ApiError(502, 'Bad gateway');
      return { project: envelope({ room, spa }) };
    });
    render(<RepoChangePreview />);
    act(() => openRepoChangePreview());

    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/added Room/)).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('reads an older version with no model as empty', async () => {
    loadModelAtCommit.mockImplementation(async (_session, _owner, _repo, sha) => {
      if (sha === BASE) throw new ApiError(404, 'No model');
      return { project: envelope({ room, spa }) };
    });
    await showPreview();
    expect(screen.getByText('@ben added Room, Spa')).toBeInTheDocument();
  });

  it('stays open while a check is running or failed', async () => {
    const { rerender } = render(<RepoChangePreview />);
    act(() => openRepoChangePreview());
    await screen.findByText(/Your model has not changed/);

    for (const transient of ['checking', 'unknown'] as RepoSyncState[]) {
      sync.state = transient;
      rerender(<RepoChangePreview />);
      expect(screen.getByRole('region')).toBeInTheDocument();
    }
  });

  it('leaves Escape to a dialog open above it', async () => {
    await showPreview();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.appendChild(dialog);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByRole('region')).toBeInTheDocument();
    dialog.remove();
  });

  it('closes when the project changes', async () => {
    const { rerender } = render(<RepoChangePreview />);
    act(() => openRepoChangePreview());
    await screen.findByText(/Your model has not changed/);

    current.currentProject = { ...project({ room }), id: 'p2' };
    rerender(<RepoChangePreview />);

    await waitFor(() => expect(screen.queryByRole('region')).toBeNull());
  });

  it('does not name one person for changes several made', async () => {
    sync.status = { ...sync.status, commits_since: [commit, { ...commit, author: 'Ana', author_login: 'ana' }] };
    await showPreview();

    expect(screen.getByText('Removed: Old')).toBeInTheDocument();
    expect(screen.getByText('Added: Spa')).toBeInTheDocument();
    sync.status = { ...sync.status, commits_since: [commit] };
  });

  it('says how many relationships changed', async () => {
    loadModelAtCommit.mockImplementation(async (_session, _owner, _repo, sha) => ({
      project: {
        ...envelope({ room }),
        project: { ...project({ room }), type: 'Project', name: 'Hotel', schemaVersion: 3, diagrams: { ClassDiagram: [{ id: 'd1', model: { elements: { room }, relationships: sha === HEAD ? { r1: {} } : {} } }] } },
      },
    }));
    await showPreview();

    expect(screen.getByText('1 new relationship')).toBeInTheDocument();
    expect(screen.queryByText(/class diagrams are the same/)).toBeNull();
  });

  it('closes and reports when the new version cannot be read', async () => {
    loadModelAtCommit.mockRejectedValue(new Error('down'));
    render(<RepoChangePreview />);
    act(() => openRepoChangePreview());

    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('region')).toBeNull();
  });
});
