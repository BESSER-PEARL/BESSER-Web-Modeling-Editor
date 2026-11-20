import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LabCheckRun, LabPullRequestStatus, LabReviewComment, LabReviewResponse } from '@/main/shared/api/lab';

vi.mock('@/main/shared/api/lab', () => ({ getLabReview: vi.fn() }));

import { getLabReview } from '@/main/shared/api/lab';
import { ApiError } from '@/main/shared/api/api-client';
import { reviewDigest, useLabReview } from '../useLabReview';

const CHANGE = 'abcdef012345';
const SESSION = 'session-1';

const check = (name: string, state: LabCheckRun['state']): LabCheckRun => ({
  name,
  app: 'github-actions',
  state,
  url: null,
  logTail: null,
  logNote: '',
});

const comment = (id: string, overrides: Partial<LabReviewComment> = {}): LabReviewComment => ({
  id,
  author: 'maintainer',
  authorAssociation: 'MEMBER',
  trusted: true,
  body: 'Please rename this.',
  url: `https://github.com/o/r/pull/7#${id}`,
  createdAt: '2026-11-20T10:00:00Z',
  path: 'a.py',
  line: 3,
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

const review = (
  pullRequests: LabPullRequestStatus[],
  overrides: Partial<LabReviewResponse> = {},
): LabReviewResponse => ({
  changeId: CHANGE,
  pullRequests,
  lifecycle: 'open',
  closable: false,
  closableNote: '',
  nextPollSeconds: 30,
  fetchedAt: 0,
  ...overrides,
});

const mocked = vi.mocked(getLabReview);

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  mocked.mockReset();
  setHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
  setHidden(false);
});

describe('reviewDigest', () => {
  it('lists failing checks and open comments, not resolved or outdated ones', () => {
    const digest = reviewDigest(
      review([
        pullRequest({
          checks: [check('lint', 'failure'), check('test', 'success')],
          comments: [comment('c1'), comment('c2', { resolved: true }), comment('c3', { outdated: true })],
        }),
      ]),
    );
    expect(digest.failingChecks).toEqual(['besser#7: lint']);
    expect(digest.commentIds).toEqual(['c1']);
    expect(digest.lifecycle).toBe('open');
  });
});

describe('useLabReview', () => {
  it('polls at the interval the server returns', async () => {
    mocked.mockResolvedValue(review([pullRequest()], { nextPollSeconds: 30 }));
    renderHook(() => useLabReview(CHANGE, SESSION, vi.fn()));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(mocked).toHaveBeenCalledWith(SESSION, CHANGE);

    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(mocked).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(mocked).toHaveBeenCalledTimes(2);

    mocked.mockResolvedValue(review([pullRequest()], { nextPollSeconds: 120 }));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(mocked).toHaveBeenCalledTimes(3);
    await act(() => vi.advanceTimersByTimeAsync(119_000));
    expect(mocked).toHaveBeenCalledTimes(3);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(mocked).toHaveBeenCalledTimes(4);
  });

  it('stops when the server answers no next poll', async () => {
    mocked.mockResolvedValue(review([pullRequest({ state: 'merged' })], { lifecycle: 'merged', nextPollSeconds: null }));
    const { result } = renderHook(() => useLabReview(CHANGE, SESSION, vi.fn()));
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(result.current.review?.lifecycle).toBe('merged');
  });

  it('pauses while the tab is hidden and polls when it is shown again', async () => {
    mocked.mockResolvedValue(review([pullRequest()], { nextPollSeconds: 30 }));
    renderHook(() => useLabReview(CHANGE, SESSION, vi.fn()));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(mocked).toHaveBeenCalledTimes(1);

    act(() => setHidden(true));
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
    expect(mocked).toHaveBeenCalledTimes(1);

    act(() => setHidden(false));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(mocked).toHaveBeenCalledTimes(2);
  });

  it('reports a new failure once, and what is failing at load on the first poll', async () => {
    const onUpdate = vi.fn();
    mocked.mockResolvedValueOnce(review([pullRequest({ checks: [check('lint', 'failure')], comments: [comment('c1')] })]));
    renderHook(() => useLabReview(CHANGE, SESSION, onUpdate));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][1]).toEqual({ failingChecks: ['besser#7: lint'], commentIds: ['c1'], lifecycle: null });

    // Same state: nothing new, nothing reported.
    mocked.mockResolvedValueOnce(review([pullRequest({ checks: [check('lint', 'failure')], comments: [comment('c1')] })]));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // A second check fails: only it is reported.
    mocked.mockResolvedValue(
      review([pullRequest({ checks: [check('lint', 'failure'), check('test', 'failure')], comments: [comment('c1')] })]),
    );
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[1][1]).toEqual({ failingChecks: ['besser#7: test'], commentIds: [], lifecycle: null });

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(mocked).toHaveBeenCalledTimes(4);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('reports a lifecycle change, and nothing for a healthy open change at load', async () => {
    const onUpdate = vi.fn();
    mocked.mockResolvedValueOnce(review([pullRequest()]));
    renderHook(() => useLabReview(CHANGE, SESSION, onUpdate));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(onUpdate).not.toHaveBeenCalled();

    mocked.mockResolvedValueOnce(review([pullRequest({ state: 'merged' })], { lifecycle: 'merged', nextPollSeconds: null }));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][1]).toEqual({ failingChecks: [], commentIds: [], lifecycle: 'merged' });
  });

  it('does nothing without a change or a session', async () => {
    renderHook(() => useLabReview(null, SESSION, vi.fn()));
    renderHook(() => useLabReview(CHANGE, null, vi.fn()));
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(mocked).not.toHaveBeenCalled();
  });

  it('stops on a refusal and keeps the error for the caller to show', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.mockRejectedValue(new ApiError(404, 'Change not found'));
    const { result } = renderHook(() => useLabReview(CHANGE, SESSION, vi.fn()));
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('retries a failure that is not a refusal', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocked.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mocked.mockResolvedValue(review([pullRequest()]));
    const { result } = renderHook(() => useLabReview(CHANGE, SESSION, vi.fn()));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.error).toBeInstanceOf(TypeError);
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    warn.mockRestore();
  });
});
