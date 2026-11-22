import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const listRepos = vi.fn();
const listBranches = vi.fn(async () => ['main']);
const getRepoSummary = vi.fn();
vi.mock('../../../api/github', () => ({
  BESSER_TOPIC: 'besser',
  listRepos: (...args: unknown[]) => listRepos(...args),
  listBranches: (...args: unknown[]) => listBranches(...(args as [])),
  getRepoSummary: (...args: unknown[]) => getRepoSummary(...args),
}));

import { RepoBrowser } from '../RepoBrowser';

const repo = (id: number, name: string, topics: string[] = [], updated = '2026-10-20T10:00:00Z') => ({
  id,
  name,
  full_name: `me/${name}`,
  description: null,
  html_url: `https://github.com/me/${name}`,
  private: false,
  updated_at: updated,
  default_branch: 'main',
  topics,
});

const summary = {
  has_model: true,
  branch: 'main',
  head_sha: 'b'.repeat(40),
  project_name: 'Library',
  project_id: 'p1',
  diagram_counts: { ClassDiagram: 1, GUINoCodeDiagram: 1 },
  class_count: 2,
  class_names: ['Author', 'Book'],
  last_commit: {
    sha: 'b'.repeat(40),
    message: 'Add the Loan class\n\nBESSER-Origin: spec-driven-agent',
    author: 'Ana',
    date: '2026-10-25T10:00:00Z',
    html_url: '',
    origin: 'spec-driven-agent' as const,
  },
};

const renderBrowser = async (onAction = vi.fn(), allowWithoutModel = false) => {
  render(<RepoBrowser githubSession="s" actionLabel="Continue" onAction={onAction} allowWithoutModel={allowWithoutModel} />);
  await act(async () => {
    await Promise.resolve();
  });
  return onAction;
};

describe('RepoBrowser', () => {
  it('lists BESSER projects first and folds the other repositories away', async () => {
    listRepos.mockResolvedValue({ repositories: [repo(1, 'notes'), repo(2, 'library-app', ['besser']), repo(3, 'dotfiles')], truncated: false });
    await renderBrowser();

    expect(screen.getByText('me/library-app')).toBeInTheDocument();
    expect(screen.queryByText('me/notes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Show 2 other repositories/));
    expect(screen.getByText('me/notes')).toBeInTheDocument();
  });

  it("names the repository's diagrams in the UI language", async () => {
    const i18n = (await import('../../../i18n')).default;
    await i18n.changeLanguage('de');
    try {
      listRepos.mockResolvedValue({ repositories: [repo(2, 'library-app', ['besser'])], truncated: false });
      getRepoSummary.mockResolvedValue(summary);
      await renderBrowser();
      await act(async () => {
        fireEvent.click(screen.getByText('me/library-app'));
      });
      expect(await screen.findByText('Klasse')).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('searches every repository, not only the BESSER ones', async () => {
    listRepos.mockResolvedValue({ repositories: [repo(1, 'notes'), repo(2, 'library-app', ['besser'])], truncated: false });
    await renderBrowser();

    fireEvent.change(screen.getByLabelText('Search your repositories'), { target: { value: 'not' } });
    expect(screen.getByText('me/notes')).toBeInTheDocument();
    expect(screen.queryByText('me/library-app')).not.toBeInTheDocument();
  });

  it('shows what a repo holds and who changed it last before acting on it', async () => {
    listRepos.mockResolvedValue({ repositories: [repo(2, 'library-app', ['besser'])], truncated: false });
    getRepoSummary.mockResolvedValue(summary);
    const onAction = await renderBrowser();

    await act(async () => {
      fireEvent.click(screen.getByText('me/library-app'));
    });

    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText(/2 classes: Author, Book/)).toBeInTheDocument();
    expect(screen.getByText('Add the Loan class')).toBeInTheDocument();
    expect(screen.getByText('Spec-Driven Agent')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onAction).toHaveBeenCalledWith({ owner: 'me', repo: 'library-app', branch: 'main', summary });
  });

  it('will not open a repo without a model unless the caller links empty repos', async () => {
    listRepos.mockResolvedValue({ repositories: [repo(1, 'notes')], truncated: false });
    getRepoSummary.mockResolvedValue({ ...summary, has_model: false, last_commit: null });
    await renderBrowser();

    await act(async () => {
      fireEvent.click(screen.getByText('me/notes'));
    });
    expect(screen.getByText('No BESSER model in this repository yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
