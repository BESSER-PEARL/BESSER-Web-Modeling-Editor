import React from 'react';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../../app/store/store';
import {
  getLabDiff,
  getLabReview,
  type LabChangeDetail,
  type LabDiffResponse,
  type LabReviewResponse,
} from '../../../shared/api/lab';
import { LabChangesTab, type LabChangesTabProps } from '../LabChangesTab';

vi.mock('../../../shared/api/lab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../shared/api/lab')>()),
  getLabReview: vi.fn(),
  getLabDiff: vi.fn(),
}));

const SESSION = 'gh-session-0123456789';
const PR = { repo: 'frontend', number: 301, url: 'https://github.com/BESSER-PEARL/BESSER-Web-Modeling-Editor/pull/301', branch: 'lab/note-element', base: 'develop' };

const BUILT = {
  changeId: 'c1',
  title: 'Note element',
  kind: 'editor_element',
  status: 'open',
  owner: 'ana',
  phase: 'built',
  updatedAt: 100,
  pullRequests: [PR],
  cost: { usd: 1.82, turns: 30, elapsedSeconds: 400, runs: 3 },
  view: {
    step: 'build',
    changeId: 'c1',
    title: 'Note element',
    kind: 'editor_element',
    repoChanges: [
      {
        repo: 'frontend',
        branch: 'lab/note-element',
        base: 'develop',
        files: [
          { path: 'packages/editor/src/main/packages/uml-class-diagram/note/note.ts', status: 'added' },
          { path: 'packages/editor/src/main/packages/components.ts', status: 'modified' },
        ],
      },
    ],
    checks: [
      { id: 'tsc', repo: 'frontend', title: 'Type check', passed: true, skipped: false, summary: '', durationSeconds: 53 },
      { id: 'vitest', repo: 'frontend', title: 'Unit tests', passed: false, skipped: false, summary: '2 failed', durationSeconds: 110 },
    ],
    checklist: [
      { id: 'popup', text: 'Register the property popup in popups.ts', done: true },
      { id: 'palette', text: 'Add the palette entry to the class preview', done: false },
    ],
    summary: '',
    stopReason: 'completed',
    report: { summary: 'Added the Note element.', deviations: [], notDone: ['The ER notation'] },
    pullRequests: [PR],
    cost: { usd: 1.82, turns: 30, elapsedSeconds: 400, runs: 3 },
    issues: [],
  },
} as unknown as LabChangeDetail;

const REVIEW: LabReviewResponse = {
  changeId: 'c1',
  pullRequests: [
    {
      repo: 'frontend',
      number: 301,
      url: PR.url,
      draft: true,
      headSha: 'abc',
      state: 'open',
      pushedSha: 'abc',
      mergeable: 'mergeable',
      mergeState: 'clean',
      reviewDecision: 'CHANGES_REQUESTED',
      checksState: 'failure',
      checks: [{ name: 'webapp tests', app: 'GitHub Actions', state: 'failure', url: null, logTail: null, logNote: '' }],
      reviews: [],
      comments: [],
    },
  ],
  lifecycle: 'open',
  closable: false,
  closableNote: '',
  nextPollSeconds: 30,
  fetchedAt: 100,
};

const DIFF = {
  changeId: 'c1',
  repos: [
    {
      repo: 'frontend',
      branch: 'lab/note-element',
      base: 'develop',
      files: [
        {
          path: 'packages/editor/src/main/packages/components.ts',
          oldPath: null,
          status: 'modified',
          additions: 1,
          deletions: 0,
          binary: false,
          omitted: null,
          redactions: 0,
          patch: 'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,1 +1,2 @@\n line one\n+line two\n',
        },
      ],
    },
  ],
} as unknown as LabDiffResponse;

function renderTab(overrides: Partial<LabChangesTabProps> = {}) {
  const props: LabChangesTabProps = {
    change: BUILT,
    githubSession: SESSION,
    visible: true,
    diff: { open: false },
    onDiffChange: vi.fn(),
    onSendComments: vi.fn(),
    onReviewAction: vi.fn(async () => undefined),
    ...overrides,
  };
  const view = render(
    <Provider store={store}>
      <LabChangesTab {...props} />
    </Provider>,
  );
  return { props, rerender: (next: Partial<LabChangesTabProps>) => view.rerender(
    <Provider store={store}>
      <LabChangesTab {...props} {...next} />
    </Provider>,
  ) };
}

beforeEach(() => {
  vi.mocked(getLabReview).mockReset().mockResolvedValue(REVIEW);
  vi.mocked(getLabDiff).mockReset().mockResolvedValue(DIFF);
});
afterEach(cleanup);

describe('LabChangesTab', () => {
  it('shows the files per repository, the checks with their durations and the checklist of the last build', async () => {
    renderTab();
    const build = screen.getByRole('region', { name: 'Changed files' });
    expect(build).toHaveTextContent('Web editor');
    expect(build).toHaveTextContent('packages/editor/src/main/packages/uml-class-diagram/note/note.ts');
    expect(build).toHaveTextContent('added');
    const checks = screen.getByRole('region', { name: 'Checks' });
    expect(checks).toHaveTextContent('Type check');
    expect(checks).toHaveTextContent('53s');
    expect(checks).toHaveTextContent('1m 50s');
    expect(checks).toHaveTextContent('2 failed');
    const checklist = screen.getByRole('region', { name: 'Checklist' });
    expect(within(checklist).getByRole('img', { name: 'Missing' })).toBeTruthy();
    expect(checklist).toHaveTextContent('Add the palette entry to the class preview');
    expect(screen.getByText('Added the Note element.')).toBeTruthy();
    await screen.findByText(/webapp tests/);
  });

  it('shows the pull requests as GitHub reports them, and reads them again when the change moves', async () => {
    const { rerender } = renderTab();
    expect(await screen.findByText(/webapp tests/)).toBeTruthy();
    expect(getLabReview).toHaveBeenCalledWith(SESSION, 'c1');
    expect(screen.getByRole('button', { name: /Fix CI/ })).toBeTruthy();
    rerender({ change: { ...BUILT, updatedAt: 200 } });
    await act(async () => undefined);
    expect(getLabReview).toHaveBeenCalledTimes(2);
  });

  it('reads no review while hidden, nor for a change without pull requests', async () => {
    renderTab({ visible: false });
    renderTab({ change: { ...BUILT, pullRequests: [] } });
    await act(async () => undefined);
    expect(getLabReview).not.toHaveBeenCalled();
    expect(screen.getByText('No pull request is open for this change yet.')).toBeTruthy();
  });

  it("hands a review card's action to the chat with the change id", async () => {
    const { props } = renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Fix CI/ }));
    expect(props.onReviewAction).toHaveBeenCalledWith('c1', { kind: 'fixCi', repo: 'frontend' });
  });

  it('opens the diff with "View changes", and sends its line comments as a chat message', async () => {
    const { props, rerender } = renderTab();
    fireEvent.click(screen.getAllByRole('button', { name: /View changes/ })[0]);
    expect(props.onDiffChange).toHaveBeenCalledWith({ open: true });

    rerender({ diff: { open: true } });
    // The dialog and react-diff-view load lazily; under a full parallel run that takes more than the default second.
    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 });
    await within(dialog).findByText('line two');
    expect(getLabDiff).toHaveBeenCalledWith(SESSION, 'c1', undefined);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Comment on the file' }));
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Register it in the palette too.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add comment' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Send to the lab agent/ }));
    expect(props.onSendComments).toHaveBeenCalledWith(expect.stringContaining('Register it in the palette too.'));
  });

  it('says nothing is built yet for a change without a build', () => {
    renderTab({ change: { ...BUILT, view: null, pullRequests: [] } });
    expect(screen.getByText(/Nothing is built yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View changes' })).toBeDisabled();
  });
});
