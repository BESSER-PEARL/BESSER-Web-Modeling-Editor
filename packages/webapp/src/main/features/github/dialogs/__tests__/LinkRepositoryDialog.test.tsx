import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: { id: 'p1' } }) }));
// Closing a confirmation (Escape, X, outside) answers false.
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn(async () => false) }));
const HEAD = 'h'.repeat(40);
const summary = (hasModel: boolean) => ({
  has_model: hasModel, branch: 'main', head_sha: HEAD, project_name: 'Shop', project_id: null,
  diagram_counts: {}, class_count: 0, class_names: [], last_commit: null,
});
const picked = vi.hoisted(() => ({ hasModel: true }));
vi.mock('../../../../shared/components/github/RepoBrowser', () => ({
  RepoBrowser: ({ onAction }: { onAction: (choice: unknown) => void }) => (
    <button type="button" onClick={() => onAction({ owner: 'ana', repo: 'shop', branch: 'main', summary: summary(picked.hasModel) })}>
      pick ana/shop
    </button>
  ),
}));

import { LinkRepositoryDialog } from '../LinkRepositoryDialog';

const sync = { githubSession: 's', linkTo: vi.fn(), pullInto: vi.fn(async () => ({})) };

function openAndPick(hasModel = true) {
  picked.hasModel = hasModel;
  const onOpenChange = vi.fn();
  render(<LinkRepositoryDialog open onOpenChange={onOpenChange} sync={sync as never} />);
  fireEvent.click(screen.getByRole('button', { name: 'pick ana/shop' }));
  return onOpenChange;
}

afterEach(() => {
  cleanup();
  sync.linkTo.mockClear();
  sync.pullInto.mockClear();
});

describe('LinkRepositoryDialog — a repository that holds a model', () => {
  it('links nothing when the user closes the question with Escape', async () => {
    // Review repro: Escape, X, Cancel and click-outside all linked the repository.
    const onOpenChange = openAndPick();
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(sync.linkTo).not.toHaveBeenCalled();
    expect(sync.pullInto).not.toHaveBeenCalled();
  });

  it('links nothing on Cancel, and goes back to the repositories', async () => {
    openAndPick();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(sync.linkTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'pick ana/shop' })).toBeTruthy();
  });

  it('keeps the local model and links only on "Keep my model and link"', async () => {
    const onOpenChange = openAndPick();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Keep my model and link/ }));
    });
    expect(sync.linkTo).toHaveBeenCalledWith('ana', 'shop', 'main', HEAD);
    expect(sync.pullInto).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("loads the repository's model on request", async () => {
    openAndPick();
    fireEvent.click(screen.getByRole('button', { name: /Load the repository model/ }));
    await waitFor(() => expect(sync.pullInto).toHaveBeenCalledWith({ owner: 'ana', repo: 'shop', branch: 'main' }, 'p1'));
    expect(sync.linkTo).not.toHaveBeenCalled();
  });
});

describe('LinkRepositoryDialog — a repository without a model', () => {
  it('links straight away, keeping the local model', async () => {
    openAndPick(false);
    await waitFor(() => expect(sync.linkTo).toHaveBeenCalledWith('ana', 'shop', 'main', HEAD));
  });
});
