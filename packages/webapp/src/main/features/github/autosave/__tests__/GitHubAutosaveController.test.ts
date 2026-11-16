import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../shared/api/api-client';
import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_MAX_BACKOFF_MS,
  AUTOSAVE_MIN_INTERVAL_MS,
  AutosaveCheckError,
  GitHubAutosaveController,
  autosaveBackoffMs,
  type AutosaveStatus,
} from '../GitHubAutosaveController';

const setup = () => {
  const statuses: AutosaveStatus[] = [];
  const steps = {
    hasChanges: vi.fn(() => true),
    remoteMoved: vi.fn(async () => false),
    save: vi.fn(async (): Promise<'saved' | 'conflict'> => 'saved'),
    onStatus: (status: AutosaveStatus) => statuses.push(status),
    now: () => Date.now(),
  };
  const controller = new GitHubAutosaveController(steps);
  const last = () => statuses[statuses.length - 1];
  return { controller, steps, statuses, last };
};

// Lets the save's awaits settle without moving the clock.
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-15T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('GitHubAutosaveController', () => {
  it('is off until enabled, and ignores edits meanwhile', async () => {
    const { controller, steps, statuses } = setup();
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(10 * AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.save).not.toHaveBeenCalled();
    expect(statuses).toEqual([]);
    controller.setEnabled(true);
    expect(statuses[statuses.length - 1]).toEqual({ phase: 'idle', lastSavedAt: undefined });
  });

  it('saves once, a few seconds after the last of a burst of edits', async () => {
    const { controller, steps, last } = setup();
    controller.setEnabled(true);
    controller.notifyChange();
    expect(last().phase).toBe('waiting');
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 1_000);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS - 1_000);
    controller.notifyChange();
    expect(steps.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(steps.save).toHaveBeenCalledTimes(1);
    expect(last()).toEqual({ phase: 'idle', lastSavedAt: Date.now() });
  });

  it('commits at most once a minute, batching the edits in between', async () => {
    const { controller, steps } = setup();
    controller.setEnabled(true);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(steps.save).toHaveBeenCalledTimes(1);
    const firstAt = Date.now();

    for (let i = 0; i < 5; i += 1) {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 1_000);
      controller.notifyChange();
    }
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(Date.now() - firstAt).toBeLessThan(AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.save).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(firstAt + AUTOSAVE_MIN_INTERVAL_MS - Date.now());
    expect(steps.save).toHaveBeenCalledTimes(2);
  });

  it('never commits when the model matches the repository', async () => {
    const { controller, steps, last } = setup();
    steps.hasChanges.mockReturnValue(false);
    controller.setEnabled(true);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(steps.remoteMoved).not.toHaveBeenCalled();
    expect(steps.save).not.toHaveBeenCalled();
    expect(last().phase).toBe('idle');
  });

  it('does not push over new commits, and pauses until the repo state lifts it', async () => {
    const { controller, steps, last } = setup();
    steps.remoteMoved.mockResolvedValueOnce(true);
    controller.setEnabled(true);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(steps.save).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ phase: 'paused', pause: 'remote' });

    // Paused: further edits wait.
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(5 * AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.save).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ phase: 'paused', pause: 'remote' });

    // Get latest / Save and merge brought the branch in: the waiting edits are saved.
    controller.setPaused(null);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(steps.save).toHaveBeenCalledTimes(1);
  });

  it('pauses while the repo state says so (teammate commits, an unmerged save)', async () => {
    const { controller, steps, last } = setup();
    controller.setEnabled(true);
    controller.setPaused('remote');
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.hasChanges).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ phase: 'paused', pause: 'remote' });
  });

  it('pauses after a save GitHub could not merge', async () => {
    const { controller, steps, last } = setup();
    steps.save.mockResolvedValueOnce('conflict');
    controller.setEnabled(true);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(last()).toMatchObject({ phase: 'paused', pause: 'conflict' });
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(5 * AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.save).toHaveBeenCalledTimes(1);
  });

  // The conflicted save's edits are still unsaved: once the conflict is
  // resolved they go out without waiting for another edit.
  it('saves the unsaved model when a conflict pause lifts, without a new edit', async () => {
    const { controller, steps } = setup();
    steps.save.mockResolvedValueOnce('conflict');
    controller.setEnabled(true);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    controller.setPaused(null);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.save).toHaveBeenCalledTimes(2);
  });

  it('backs off after failures instead of retrying on every edit', async () => {
    const { controller, steps, last } = setup();
    const triedAt: number[] = [];
    steps.save.mockImplementation(async () => {
      triedAt.push(Date.now());
      throw new ApiError(503, 'GitHub is down');
    });
    controller.setEnabled(true);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(triedAt).toHaveLength(1);
    expect(last()).toMatchObject({ phase: 'error', retryAt: triedAt[0] + autosaveBackoffMs(1) });

    // Edits during the wait do not bring the next try forward.
    for (let i = 0; i < 10; i += 1) {
      controller.notifyChange();
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    }
    expect(triedAt).toHaveLength(1);
    expect(last().phase).toBe('error');

    await vi.advanceTimersByTimeAsync(triedAt[0] + autosaveBackoffMs(1) - Date.now());
    expect(triedAt).toEqual([triedAt[0], triedAt[0] + autosaveBackoffMs(1)]);
    // The second failure waits twice as long.
    expect(last()).toMatchObject({ phase: 'error', retryAt: triedAt[1] + autosaveBackoffMs(2) });
    await vi.advanceTimersByTimeAsync(autosaveBackoffMs(2) - 1);
    expect(triedAt).toHaveLength(2);

    steps.save.mockResolvedValue('saved');
    await vi.advanceTimersByTimeAsync(1);
    expect(steps.save).toHaveBeenCalledTimes(3);
    expect(last()).toEqual({ phase: 'idle', lastSavedAt: Date.now() });
  });

  it('caps the back-off', () => {
    expect(autosaveBackoffMs(1)).toBe(AUTOSAVE_MIN_INTERVAL_MS);
    expect(autosaveBackoffMs(2)).toBe(2 * AUTOSAVE_MIN_INTERVAL_MS);
    expect(autosaveBackoffMs(30)).toBe(AUTOSAVE_MAX_BACKOFF_MS);
  });

  it('backs off when GitHub cannot be reached for the check, e.g. offline', async () => {
    const { controller, steps, last } = setup();
    steps.remoteMoved.mockRejectedValueOnce(new AutosaveCheckError('unreachable'));
    controller.setEnabled(true);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(steps.save).not.toHaveBeenCalled();
    expect(last().phase).toBe('error');

    // Back online: try now rather than at the end of the wait.
    controller.retryNow();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(steps.save).toHaveBeenCalledTimes(1);
  });

  it('pauses on an expired session instead of retrying', async () => {
    const { controller, steps, last } = setup();
    steps.save.mockRejectedValueOnce(new ApiError(401, 'Bad credentials'));
    controller.setEnabled(true);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(last()).toMatchObject({ phase: 'paused', pause: 'auth' });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MAX_BACKOFF_MS * 2);
    expect(steps.save).toHaveBeenCalledTimes(1);

    // Reconnected: the hook sets the repo state again, which lifts the pause.
    controller.setPaused(null);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.save).toHaveBeenCalledTimes(2);
  });

  it('saves the edits made while a save was running in the next one', async () => {
    const { controller, steps } = setup();
    let finish: (value: 'saved') => void = () => undefined;
    steps.save.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    controller.setEnabled(true);
    controller.notifyChange();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(steps.save).toHaveBeenCalledTimes(1);
    controller.notifyChange();
    finish('saved');
    await settle();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.save).toHaveBeenCalledTimes(2);
  });

  it('drops waiting edits when turned off, and stops after dispose', async () => {
    const { controller, steps, last } = setup();
    controller.setEnabled(true);
    controller.notifyChange();
    controller.setEnabled(false);
    expect(last()).toEqual({ phase: 'off' });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.save).not.toHaveBeenCalled();

    controller.setEnabled(true);
    controller.notifyChange();
    controller.dispose();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MIN_INTERVAL_MS);
    expect(steps.save).not.toHaveBeenCalled();
  });
});
