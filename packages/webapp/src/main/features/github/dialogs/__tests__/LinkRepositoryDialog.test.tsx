import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../../../app/hooks/useProject', () => ({ useProject: () => ({ currentProject: { id: 'p1' } }) }));
// Closing a confirmation (Escape, X, outside) answers false.
vi.mock('../../../../shared/services/confirm/globalConfirm', () => ({ globalConfirm: vi.fn(async () => false) }));
const HEAD = 'h'.repeat(40);
const summary = (hasModel: boolean, models: string[]) => ({
  has_model: hasModel, branch: 'main', head_sha: HEAD, project_name: 'Shop', project_id: null,
  diagram_counts: {}, class_count: 0, class_names: [], last_commit: null,
  model_path: models[0] ?? null, model_paths: models,
});
const picked = vi.hoisted(() => ({ hasModel: true, models: ['buml/diagrams.json'] }));
vi.mock('../../../../shared/components/github/RepoBrowser', () => ({
  RepoBrowser: ({ onAction }: { onAction: (choice: unknown) => void }) => (
    <button type="button" onClick={() => onAction({ owner: 'ana', repo: 'shop', branch: 'main', summary: summary(picked.hasModel, picked.models) })}>
      pick ana/shop
    </button>
  ),
}));

import { LinkRepositoryDialog } from '../LinkRepositoryDialog';

const sync = { githubSession: 's', linkTo: vi.fn(), pullInto: vi.fn(async () => ({})) };

function openAndPick(hasModel = true, models = hasModel ? ['buml/diagrams.json'] : []) {
  picked.hasModel = hasModel;
  picked.models = models;
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
    expect(sync.linkTo).toHaveBeenCalledWith('ana', 'shop', 'main', HEAD, 'buml/diagrams.json');
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
    await waitFor(() => expect(sync.linkTo).toHaveBeenCalledWith('ana', 'shop', 'main', HEAD, null));
  });
});

describe('LinkRepositoryDialog — a model an older editor saved', () => {
  it('asks nothing more for one file, and remembers it so the next save replaces it', async () => {
    openAndPick(true, ['ocl_gen.json']);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Keep my model and link/ }));
    });
    expect(sync.linkTo).toHaveBeenCalledWith('ana', 'shop', 'main', HEAD, 'ocl_gen.json');
  });

  it('lets the user pick between several model files, and loads the one picked', async () => {
    openAndPick(true, ['buml/diagrams.json', 'ocl_gen.json']);
    const files = screen.getAllByRole('radio').map((radio) => radio.textContent);
    expect(files).toEqual(['buml/diagrams.json', 'ocl_gen.json']);
    expect(screen.getByRole('radio', { name: 'buml/diagrams.json' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: 'ocl_gen.json' }));
    fireEvent.click(screen.getByRole('button', { name: /Load the repository model/ }));

    await waitFor(() => expect(sync.pullInto).toHaveBeenCalledWith(
      { owner: 'ana', repo: 'shop', branch: 'main', legacyFilePath: 'ocl_gen.json' }, 'p1',
    ));
  });
});
