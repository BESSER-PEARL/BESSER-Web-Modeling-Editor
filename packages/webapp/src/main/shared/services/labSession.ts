/**
 * BESSER Lab, in memory: the change open in this tab, and the views cards ask for.
 *
 * Chat cards (run card, review card) never import the change view: they ask for a view of a change
 * here, and the change view, subscribed while it is mounted, opens it. Nothing is stored.
 */
import type { LabIssueRef } from '../api/lab';

/** Router state `{ labStart }` passed to `/c/:changeId` when the home starts a change with a first message. */
export type LabStartState = { message: string; issue?: LabIssueRef };

/** A view of change `changeId` a card asks the change view to open; `file` picks one file of the diff. */
export type LabViewRequest = {
  kind: 'changes' | 'pullRequest' | 'tryIt' | 'model';
  changeId: string;
  file?: { repo: string; path: string };
};

let openChange: string | null = null;
const openChangeListeners = new Set<(changeId: string | null) => void>();
const viewListeners = new Set<(request: LabViewRequest) => void>();

/** Sets the change open in this tab (null: none); every subscriber hears of a change of it. */
export function setOpenLabChange(changeId: string | null): void {
  if (changeId === openChange) return;
  openChange = changeId;
  for (const listener of [...openChangeListeners]) listener(changeId);
}

/** The change open in this tab, or null. */
export function getOpenLabChange(): string | null {
  return openChange;
}

/** Calls `listener` with the open change each time it changes; returns the unsubscribe function. */
export function subscribeOpenLabChange(listener: (changeId: string | null) => void): () => void {
  openChangeListeners.add(listener);
  return () => {
    openChangeListeners.delete(listener);
  };
}

/** Asks every subscribed view to open `request`. */
export function requestLabView(request: LabViewRequest): void {
  if (viewListeners.size === 0) console.warn(`[lab] no change view is open to show "${request.kind}" of ${request.changeId}`);
  for (const listener of [...viewListeners]) listener(request);
}

/** Calls `listener` with every view request; returns the unsubscribe function. */
export function subscribeLabViewRequests(listener: (request: LabViewRequest) => void): () => void {
  viewListeners.add(listener);
  return () => {
    viewListeners.delete(listener);
  };
}
