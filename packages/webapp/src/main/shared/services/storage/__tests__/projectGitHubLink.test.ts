import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  GITHUB_LINK_CHANGED_EVENT,
  clearProjectGitHubLink,
  getProjectGitHubLink,
  markProjectGitHubSynced,
  modelFingerprint,
  setProjectGitHubLink,
} from '../projectGitHubLink';
import type { BesserProject } from '../../../types/project';

const project = (classes: string[]): BesserProject =>
  ({
    id: 'p1',
    name: 'Library',
    diagrams: {
      ClassDiagram: [{ id: 'd1', title: 'Library', model: { elements: Object.fromEntries(classes.map((c) => [c, { name: c }])) } }],
    },
  }) as unknown as BesserProject;

afterEach(() => localStorage.clear());

describe('one GitHub link per project', () => {
  it('adopts the old agent-push link and removes it, so only one link is left', () => {
    localStorage.setItem('besser_deploy_linked_p1_github', JSON.stringify({ owner: 'me', repo: 'app', branch: 'dev' }));

    expect(getProjectGitHubLink('p1')).toEqual({ owner: 'me', repo: 'app', branch: 'dev' });
    expect(localStorage.getItem('besser_deploy_linked_p1_github')).toBeNull();
    expect(JSON.parse(localStorage.getItem('besser_github_link_p1')!)).toMatchObject({ repo: 'app' });
  });

  it("adopts the old sidebar link with its last commit as the sync base", () => {
    localStorage.setItem(
      'besser_github_linked_repos',
      JSON.stringify({
        p1: { owner: 'me', repo: 'models', branch: 'main', filePath: 'library.json', lastCommitSha: 'a'.repeat(40) },
        p2: { owner: 'me', repo: 'other', branch: 'main', filePath: 'x.json' },
      }),
    );

    expect(getProjectGitHubLink('p1')).toMatchObject({ owner: 'me', repo: 'models', baseCommitSha: 'a'.repeat(40) });
    // Other projects' sidebar links stay until they are read.
    expect(Object.keys(JSON.parse(localStorage.getItem('besser_github_linked_repos')!))).toEqual(['p2']);
  });

  it('prefers the agent-push link when both old links exist', () => {
    localStorage.setItem('besser_deploy_linked_p1_github', JSON.stringify({ owner: 'me', repo: 'app' }));
    localStorage.setItem('besser_github_linked_repos', JSON.stringify({ p1: { owner: 'me', repo: 'models', branch: 'main' } }));

    expect(getProjectGitHubLink('p1')?.repo).toBe('app');
  });

  it('announces every change so the top bar and the sidebar update together', () => {
    const listener = vi.fn();
    window.addEventListener(GITHUB_LINK_CHANGED_EVENT, listener);
    setProjectGitHubLink('p1', { owner: 'me', repo: 'app', branch: 'main' });
    clearProjectGitHubLink('p1');
    window.removeEventListener(GITHUB_LINK_CHANGED_EVENT, listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(getProjectGitHubLink('p1')).toBeNull();
  });
});

describe('sync base', () => {
  it('records the commit and the model it matched', () => {
    markProjectGitHubSynced({ owner: 'me', repo: 'app', branch: 'main' }, project(['Book']), 'b'.repeat(40));

    const link = getProjectGitHubLink('p1')!;
    expect(link.baseCommitSha).toBe('b'.repeat(40));
    expect(link.syncedModel).toBe(modelFingerprint(project(['Book'])));
  });

  it('waits for the editor after a pull instead of fingerprinting the raw repo file', () => {
    // The editor rewrites a loaded model into its current format (seen live:
    // "+ name: str" attributes become typed fields), so a fingerprint of the
    // file as stored reported every fresh pull as "changes not saved".
    setProjectGitHubLink('p1', { owner: 'me', repo: 'app', branch: 'main', syncedModel: 'stale' });
    markProjectGitHubSynced(getProjectGitHubLink('p1')!, project(['Book']), 'c'.repeat(40), { loadedFromRepo: true });

    const link = getProjectGitHubLink('p1')!;
    expect(link.baselinePending).toBe(true);
    expect(link.syncedModel).toBeUndefined();
    expect(link.baseCommitSha).toBe('c'.repeat(40));
  });

  it('fingerprints diagram content, not metadata', () => {
    const base = project(['Book']);
    expect(modelFingerprint({ ...base, name: 'Renamed' })).toBe(modelFingerprint(base));
    expect(modelFingerprint(project(['Book', 'Loan']))).not.toBe(modelFingerprint(base));
  });
});
