import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const LATEST = 'b'.repeat(40);
const OLDER = 'a'.repeat(40);
const commit = (sha: string, message: string) => ({
  sha, message, author: 'Fitash', date: '2026-11-02T10:00:00Z', html_url: '', origin: 'editor', changes: [],
});
vi.mock('../../../../shared/api/github', () => ({
  getModelHistory: vi.fn(async () => [commit(LATEST, 'Save OCL_Gen'), commit(OLDER, 'Add ocl_gen.json')]),
}));

import { ModelHistoryDialog } from '../ModelHistoryDialog';

const renderHistory = (hasLocalChanges: boolean) => {
  const sync = {
    link: { owner: 'ana', repo: 'ocl_gen', branch: 'main' },
    githubSession: 's',
    status: { head_sha: LATEST, commits_since: [], in_sync: true },
    hasLocalChanges,
    restore: vi.fn(async () => undefined),
  };
  render(<ModelHistoryDialog open onOpenChange={vi.fn()} sync={sync as never} />);
  return sync;
};

const restoreButtons = () => screen.queryAllByRole('button', { name: /^Restore$/ });

afterEach(cleanup);

describe('ModelHistoryDialog: restoring the latest version', () => {
  it('offers no restore of the latest version while the model matches it', async () => {
    renderHistory(false);
    await screen.findByText('Add ocl_gen.json');

    expect(restoreButtons()).toHaveLength(1);
  });

  it('offers the latest version back once the model has unsaved changes, e.g. after restoring an older one', async () => {
    // Reported: after restoring the previous version, there was no way back to the latest.
    const sync = renderHistory(true);
    await screen.findByText('Add ocl_gen.json');
    expect(restoreButtons()).toHaveLength(2);

    fireEvent.click(restoreButtons()[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Restore This Version/ }));

    await waitFor(() => expect(sync.restore).toHaveBeenCalledWith(LATEST));
  });
});
