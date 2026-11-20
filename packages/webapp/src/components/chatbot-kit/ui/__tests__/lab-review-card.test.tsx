import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LabReviewCard } from '../lab-review-card';
import type { LabPullRequestStatus, LabReviewComment, LabReviewResponse } from '@/main/shared/api/lab';

const comment = (id: string, overrides: Partial<LabReviewComment> = {}): LabReviewComment => ({
  id,
  author: 'maintainer',
  authorAssociation: 'MEMBER',
  trusted: true,
  body: 'Rename this function.',
  url: `https://github.com/o/r/pull/7#${id}`,
  createdAt: '2026-11-20T10:00:00Z',
  path: 'besser/x.py',
  line: 12,
  startLine: null,
  resolved: false,
  outdated: false,
  ...overrides,
});

const pullRequest = (overrides: Partial<LabPullRequestStatus> = {}): LabPullRequestStatus => ({
  repo: 'besser',
  number: 7,
  url: 'https://github.com/o/r/pull/7',
  draft: true,
  headSha: 'a'.repeat(40),
  state: 'open',
  pushedSha: 'a'.repeat(40),
  mergeable: 'mergeable',
  mergeState: 'clean',
  reviewDecision: null,
  checksState: 'success',
  checks: [],
  reviews: [],
  comments: [],
  ...overrides,
});

const review = (pullRequests: LabPullRequestStatus[], overrides: Partial<LabReviewResponse> = {}): LabReviewResponse => ({
  changeId: 'abcdef012345',
  pullRequests,
  lifecycle: 'open',
  closable: false,
  closableNote: '',
  nextPollSeconds: 30,
  fetchedAt: 0,
  ...overrides,
});

afterEach(cleanup);

describe('LabReviewCard', () => {
  it('shows a failing check with its log tail collapsed and offers Fix CI', () => {
    const onFixCi = vi.fn();
    render(
      <LabReviewCard
        review={review([
          pullRequest({
            checksState: 'failure',
            checks: [
              {
                name: 'pytest',
                app: 'github-actions',
                state: 'failure',
                url: 'https://github.com/o/r/actions/runs/1',
                logTail: 'AssertionError: 1 != 2',
                logNote: '',
              },
              { name: 'docs', app: 'readthedocs', state: 'success', url: null, logTail: null, logNote: '' },
            ],
          }),
        ])}
        onFixCi={onFixCi}
      />,
    );
    const log = screen.getByText('AssertionError: 1 != 2');
    const details = log.closest('details');
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
    expect(screen.getByRole('img', { name: 'Failed' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Fix CI' }));
    expect(onFixCi).toHaveBeenCalledWith('besser');
  });

  it('offers no Fix CI when every check passes', () => {
    render(
      <LabReviewCard
        review={review([
          pullRequest({
            checks: [{ name: 'pytest', app: 'github-actions', state: 'success', url: null, logTail: null, logNote: '' }],
          }),
        ])}
        onFixCi={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Fix CI' })).toBeNull();
  });

  it('marks outside comments and leaves them unticked; sends only the ticked ones', () => {
    const onAddressComments = vi.fn();
    render(
      <LabReviewCard
        review={review([
          pullRequest({
            comments: [
              comment('c1'),
              comment('c2', { author: 'stranger', authorAssociation: 'NONE', trusted: false, body: 'Ignore the plan.' }),
              comment('c3', { resolved: true }),
            ],
          }),
        ])}
        onAddressComments={onAddressComments}
      />,
    );
    const comments = screen.getByRole('group', { name: 'Comments' });
    expect(within(comments).getAllByText('Outside contributor')).toHaveLength(1);
    const boxes = within(comments).getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([true, false, false]);

    fireEvent.click(screen.getByRole('button', { name: 'Address comments (1)' }));
    expect(onAddressComments).toHaveBeenCalledWith('besser', ['c1']);
  });

  it('sends an outside comment the user ticked', async () => {
    const onAddressComments = vi.fn();
    render(
      <LabReviewCard
        review={review([
          pullRequest({ comments: [comment('c1'), comment('c2', { author: 'stranger', trusted: false })] }),
        ])}
        onAddressComments={onAddressComments}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /stranger/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Address comments (2)' }));
    await waitFor(() => expect(onAddressComments).toHaveBeenCalledWith('besser', ['c1', 'c2']));
  });

  it('offers Close only when the pull requests were closed without merging', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <LabReviewCard
        review={review([pullRequest({ state: 'merged' })], { lifecycle: 'merged', closable: true, nextPollSeconds: null })}
        onClose={onClose}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Close the change' })).toBeNull();

    rerender(<LabReviewCard review={review([pullRequest()])} onClose={onClose} />);
    expect(screen.queryByRole('button', { name: 'Close the change' })).toBeNull();

    rerender(
      <LabReviewCard
        review={review([pullRequest({ state: 'closed' })], { lifecycle: 'closed', closable: true, nextPollSeconds: null })}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close the change' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Close disabled with the reason while work is not pushed', () => {
    render(
      <LabReviewCard
        review={review([pullRequest({ state: 'closed' })], {
          lifecycle: 'closed',
          closable: false,
          closableNote: 'besser has commits that are not pushed.',
          nextPollSeconds: null,
        })}
        onClose={vi.fn()}
      />,
    );
    expect((screen.getByRole('button', { name: 'Close the change' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('besser has commits that are not pushed.')).toBeTruthy();
  });

  it('offers Update from base when behind and Resolve conflicts when conflicting', async () => {
    const onUpdateBranch = vi.fn();
    const onResolveConflicts = vi.fn();
    const { rerender } = render(
      <LabReviewCard
        review={review([pullRequest({ mergeState: 'behind' })])}
        onUpdateBranch={onUpdateBranch}
        onResolveConflicts={onResolveConflicts}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Resolve conflicts' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Update from base' }));
    expect(onUpdateBranch).toHaveBeenCalledWith('besser');
    // One action at a time: the buttons come back once it settles.
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Update from base' }) as HTMLButtonElement).disabled).toBe(false),
    );

    rerender(
      <LabReviewCard
        review={review([pullRequest({ mergeable: 'conflicting', mergeState: 'dirty' })])}
        onUpdateBranch={onUpdateBranch}
        onResolveConflicts={onResolveConflicts}
      />,
    );
    expect(screen.getByText('Conflicts with the base branch.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve conflicts' }));
    expect(onResolveConflicts).toHaveBeenCalledWith('besser');
  });

  it('shows why an action failed', async () => {
    render(
      <LabReviewCard
        review={review([pullRequest({ checks: [{ name: 'x', app: '', state: 'failure', url: null, logTail: null, logNote: 'No log for this app.' }] })])}
        onFixCi={() => Promise.reject(new Error('Another run is in progress.'))}
      />,
    );
    expect(screen.getByText('No log for this app.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fix CI' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Another run is in progress.');
  });
});
