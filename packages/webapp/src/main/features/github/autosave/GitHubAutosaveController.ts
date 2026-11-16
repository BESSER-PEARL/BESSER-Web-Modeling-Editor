/**
 * When "Autosave to GitHub" commits, apart from React: a few seconds after the
 * last edit, at most once a minute, never with nothing to save, never over
 * newer commits, and with a growing wait after a failure instead of a retry
 * per edit.
 *
 * The hook (useGitHubAutosave) feeds it edits and the repo's state and gives
 * it the three steps of a save: is there anything to save, did the branch move,
 * commit.
 */
import { syncCheckError, type SyncCheckError } from '../../../shared/services/github/repoSyncStatus';

/** Why autosave waits for the user: new commits on GitHub, an unmerged save, the session, the repo. */
export type AutosavePause = 'remote' | 'conflict' | 'auth' | 'missing';

export interface AutosaveStatus {
  /** `off`: not turned on; `idle`: nothing to save; `waiting`: edits wait for the quiet time or the next slot. */
  phase: 'off' | 'idle' | 'waiting' | 'saving' | 'paused' | 'error';
  /** When the last autosave reached GitHub (ms since epoch). */
  lastSavedAt?: number;
  pause?: AutosavePause;
  /** `error`: when the next try is due. */
  retryAt?: number;
}

export interface AutosaveSteps {
  /** Whether the stored model differs from the last synced one (after writing the open diagram into it). */
  hasChanges: () => boolean;
  /** Check the branch now: true when it has commits the project does not. Rejects when GitHub cannot be asked. */
  remoteMoved: () => Promise<boolean>;
  /** Commit the model; `conflict` when GitHub kept it on its own branch. */
  save: () => Promise<'saved' | 'conflict'>;
  onStatus: (status: AutosaveStatus) => void;
  now?: () => number;
}

/** A failed sync check, as an error the controller sorts like a failed save. */
export class AutosaveCheckError extends Error {
  constructor(readonly reason: SyncCheckError) {
    super(`GitHub sync check failed: ${reason}`);
  }
}

// Quiet time after the last edit before a save starts.
export const AUTOSAVE_DEBOUNCE_MS = 5_000;
// The least time between two commits.
export const AUTOSAVE_MIN_INTERVAL_MS = 60_000;
// The longest wait after failures in a row.
export const AUTOSAVE_MAX_BACKOFF_MS = 15 * 60_000;

/** The wait after `failures` failed tries in a row: one minute, doubled each time, capped. */
export const autosaveBackoffMs = (failures: number): number =>
  Math.min(AUTOSAVE_MIN_INTERVAL_MS * 2 ** Math.max(failures - 1, 0), AUTOSAVE_MAX_BACKOFF_MS);

const failureReason = (error: unknown): SyncCheckError =>
  error instanceof AutosaveCheckError ? error.reason : syncCheckError(error);

export class GitHubAutosaveController {
  private enabled = false;
  private pause: AutosavePause | null = null;
  private dirty = false;
  private running = false;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastCommitAt = Number.NEGATIVE_INFINITY;
  private failures = 0;
  private retryAt = 0;
  private lastSavedAt: number | undefined;

  constructor(private readonly steps: AutosaveSteps) {}

  private now(): number {
    return this.steps.now?.() ?? Date.now();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.clearTimer();
      this.dirty = false;
      this.failures = 0;
      this.retryAt = 0;
    }
    this.schedule();
    this.emit();
  }

  /** What the repo's state says autosave must wait for; null resumes it, and saves what waited. */
  setPaused(pause: AutosavePause | null): void {
    this.pause = pause;
    if (pause) this.clearTimer();
    else this.schedule();
    this.emit();
  }

  /** The model changed: save it once the user stops editing. */
  notifyChange(): void {
    if (!this.enabled || this.disposed) return;
    this.dirty = true;
    this.schedule();
    this.emit();
  }

  /** The browser is back online: try now instead of at the end of the wait. */
  retryNow(): void {
    if (!this.retryAt) return;
    this.retryAt = 0;
    this.schedule();
    this.emit();
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    this.clearTimer();
    if (!this.enabled || this.disposed || this.pause || this.running || !this.dirty) return;
    const now = this.now();
    const at = Math.max(now + AUTOSAVE_DEBOUNCE_MS, this.lastCommitAt + AUTOSAVE_MIN_INTERVAL_MS, this.retryAt);
    this.timer = setTimeout(() => void this.run(), at - now);
  }

  private async run(): Promise<void> {
    this.timer = null;
    if (!this.enabled || this.disposed || this.pause || this.running) return;
    this.running = true;
    try {
      if (!this.steps.hasChanges()) {
        this.dirty = false;
        return;
      }
      this.emit('saving');
      const moved = await this.steps.remoteMoved();
      if (this.disposed || !this.enabled) return;
      if (moved) {
        // The teammate-change card offers Get latest / Save and merge; the repo state lifts this.
        this.pause = 'remote';
        return;
      }
      // Edits made while this save runs mark it dirty again, for the next one.
      this.dirty = false;
      this.lastCommitAt = this.now();
      const result = await this.steps.save();
      this.failures = 0;
      this.retryAt = 0;
      if (result === 'conflict') {
        // Still unsaved: saved once the conflict is resolved and the pause lifts.
        this.pause = 'conflict';
        this.dirty = true;
      } else this.lastSavedAt = this.now();
    } catch (error) {
      this.dirty = true;
      const reason = failureReason(error);
      if (reason === 'auth' || reason === 'missing') {
        this.pause = reason;
      } else {
        this.failures += 1;
        this.retryAt = this.now() + autosaveBackoffMs(this.failures);
      }
    } finally {
      this.running = false;
      if (!this.disposed) {
        this.schedule();
        this.emit();
      }
    }
  }

  private emit(phase?: 'saving'): void {
    if (this.disposed) return;
    const lastSavedAt = this.lastSavedAt;
    let status: AutosaveStatus;
    if (!this.enabled) status = { phase: 'off' };
    else if (phase || this.running) status = { phase: phase ?? 'saving', lastSavedAt };
    else if (this.pause) status = { phase: 'paused', pause: this.pause, lastSavedAt };
    else if (this.retryAt) status = { phase: 'error', retryAt: this.retryAt, lastSavedAt };
    else status = { phase: this.dirty ? 'waiting' : 'idle', lastSavedAt };
    this.steps.onStatus(status);
  }
}
