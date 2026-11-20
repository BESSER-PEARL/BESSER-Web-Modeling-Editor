import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@/main/shared/api/api-client';
import { getLabReview, type LabReviewResponse } from '@/main/shared/api/lab';

/** Retry after a failed read that names no interval: the server's own idle interval (`POLL_IDLE_SECONDS`). */
const RETRY_SECONDS = 120;

type Lifecycle = LabReviewResponse['lifecycle'];

/** What a review status holds that the user may need to act on. */
export interface LabReviewDigest {
  /** Failing checks as `<repo>#<number>: <check name>`. */
  failingChecks: string[];
  /** Comments that are neither resolved nor outdated. */
  commentIds: string[];
  lifecycle: Lifecycle;
}

/** What is new in a review status since the previous poll. */
export interface LabReviewDigestChange {
  failingChecks: string[];
  commentIds: string[];
  /** The new lifecycle when it changed, else null. */
  lifecycle: Lifecycle | null;
}

export function reviewDigest(review: LabReviewResponse): LabReviewDigest {
  const failingChecks: string[] = [];
  const commentIds: string[] = [];
  for (const pullRequest of review.pullRequests) {
    for (const check of pullRequest.checks) {
      if (check.state === 'failure') failingChecks.push(`${pullRequest.repo}#${pullRequest.number}: ${check.name}`);
    }
    for (const comment of pullRequest.comments) {
      if (!comment.resolved && !comment.outdated) commentIds.push(comment.id);
    }
  }
  return { failingChecks, commentIds, lifecycle: review.lifecycle };
}

/** Before the first poll nothing is known, so everything failing or unresolved at load is new once. */
const AT_LOAD: LabReviewDigest = { failingChecks: [], commentIds: [], lifecycle: 'open' };

function newSince(previous: LabReviewDigest, next: LabReviewDigest): LabReviewDigestChange {
  return {
    failingChecks: next.failingChecks.filter((key) => !previous.failingChecks.includes(key)),
    commentIds: next.commentIds.filter((id) => !previous.commentIds.includes(id)),
    lifecycle: next.lifecycle === previous.lifecycle ? null : next.lifecycle,
  };
}

/**
 * Poll `GET /lab/review` for change `changeId` at the interval the server returns (`nextPollSeconds`), while
 * the tab is visible; stop when the server returns no interval or refuses (a 4xx). `onUpdate` is called only
 * when a poll finds something new: a failing check, an open comment or a lifecycle change. Returns the latest
 * status and the last read failure (null after a successful read).
 */
export function useLabReview(
  changeId: string | null,
  githubSession: string | null,
  onUpdate: (review: LabReviewResponse, changed: LabReviewDigestChange) => void,
): { review: LabReviewResponse | null; error: unknown } {
  const [state, setState] = useState<{ review: LabReviewResponse | null; error: unknown }>({
    review: null,
    error: null,
  });
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    setState({ review: null, error: null });
    if (!changeId || !githubSession) return;
    let stopped = false;
    let due = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = AT_LOAD;

    const schedule = (seconds: number) => {
      timer = setTimeout(() => {
        due = true;
        void poll();
      }, seconds * 1000);
    };

    const poll = async () => {
      // A hidden tab keeps the poll due; showing the tab runs it.
      if (stopped || inFlight || !due || document.hidden) return;
      due = false;
      inFlight = true;
      try {
        const review = await getLabReview(githubSession, changeId);
        if (stopped) return;
        const digest = reviewDigest(review);
        const changed = newSince(last, digest);
        last = digest;
        setState({ review, error: null });
        if (changed.failingChecks.length > 0 || changed.commentIds.length > 0 || changed.lifecycle) {
          onUpdateRef.current(review, changed);
        }
        if (review.nextPollSeconds !== null) schedule(review.nextPollSeconds);
      } catch (error) {
        if (stopped) return;
        const refused = error instanceof ApiError && error.status < 500;
        console.warn(
          `[lab] review status of change ${changeId} could not be read; ${refused ? 'polling stopped' : `retrying in ${RETRY_SECONDS} s`}`,
          error,
        );
        setState((previous) => ({ review: previous.review, error }));
        if (!refused) schedule(RETRY_SECONDS);
      } finally {
        inFlight = false;
      }
    };

    const onVisibility = () => void poll();
    document.addEventListener('visibilitychange', onVisibility);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [changeId, githubSession]);

  return state;
}
