import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../shared/api/api-client';
import { getLabChange, type LabChangeDetail } from '../../shared/api/lab';
import { setOpenLabChange } from '../../shared/services/labSession';

/** Re-read of the open change while the page is visible: its phase, its thread and the runs others start. */
export const LAB_CHANGE_POLL_MS = 15_000;
/** Re-read while a run of the change is in progress, so its end shows within seconds. */
export const LAB_CHANGE_RUN_POLL_MS = 3_000;

const STATUS_NOT_FOUND = 404;

export type LabChangeState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'failed'; error: unknown }
  /** `error` is the last re-read's failure; the change shown is the last one read. */
  | { status: 'ready'; change: LabChangeDetail; error: unknown };

export interface UseLabChange {
  state: LabChangeState;
  /** Reads the change now; resolves once the new state is set. */
  reload: () => Promise<void>;
}

/**
 * Change `changeId`, as `GET /lab/change` reports it, for the change view. While mounted it is the tab's open
 * change (`setOpenLabChange`), which the chat talks to; it is re-read every {@link LAB_CHANGE_POLL_MS} while the page
 * is visible and every {@link LAB_CHANGE_RUN_POLL_MS} while a run of it is in progress. A change that does not exist
 * (any more) is `notFound`, and polling stops.
 */
export function useLabChange(changeId: string, githubSession: string): UseLabChange {
  const [state, setState] = useState<LabChangeState>({ status: 'loading' });
  const readRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    setOpenLabChange(changeId);
    setState({ status: 'loading' });
    let alive = true;
    let timer: number | undefined;
    // A re-read fell due while the page was hidden: it runs when the page is shown again.
    let due = false;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible') void read();
        else due = true;
      }, ms);
    };

    const read = async (): Promise<void> => {
      due = false;
      try {
        const change = await getLabChange(githubSession, changeId);
        if (!alive) return;
        setState({ status: 'ready', change, error: null });
        schedule(change.run ? LAB_CHANGE_RUN_POLL_MS : LAB_CHANGE_POLL_MS);
      } catch (error) {
        if (!alive) return;
        if (error instanceof ApiError && error.status === STATUS_NOT_FOUND) {
          window.clearTimeout(timer);
          setState({ status: 'notFound' });
          return;
        }
        console.warn(`[lab] change ${changeId} could not be read`, error);
        setState((previous) => (previous.status === 'ready' ? { ...previous, error } : { status: 'failed', error }));
        schedule(LAB_CHANGE_POLL_MS);
      }
    };
    readRef.current = read;

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && due) void read();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void read();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      readRef.current = async () => undefined;
      setOpenLabChange(null);
    };
  }, [changeId, githubSession]);

  const reload = useCallback(() => readRef.current(), []);
  return { state, reload };
}
