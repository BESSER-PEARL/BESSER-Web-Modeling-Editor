/**
 * Unit tests for the incremental modify decision helper.
 *
 * Exercises the modify-vs-fresh branching in isolation from React,
 * Redux, and the SSE client.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decideRunMode, isValidRunId, resolveRunMode } from '../runModeDecision';
import * as modelChangeService from '../services/modelChange';
import type { ModelChange } from '../services/modelChange';
import * as confirm from '../../../shared/services/confirm/globalConfirm';

vi.mock('../services/modelChange', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/modelChange')>();
  return { ...mod, fetchModelChange: vi.fn() };
});

vi.mock('../../../shared/services/confirm/globalConfirm', () => ({
  globalConfirm: vi.fn(),
}));

const change = (verdict: ModelChange['verdict'], gone: number): ModelChange => ({
  verdict, basis: 'attributes', gone, removed: [], added: [], renamed: [],
});

// Two distinct canonical 32-hex run ids.
const RUN_A = 'a'.repeat(32);
const RUN_B = 'b'.repeat(32);

const NOW = 1_000_000_000_000; // fixed "now" in epoch ms
const TTL = 1800; // 30 min, matching the backend default

describe('isValidRunId', () => {
  it('accepts a 32-hex string', () => {
    expect(isValidRunId(RUN_A)).toBe(true);
    expect(isValidRunId('0123456789abcdef0123456789ABCDEF')).toBe(true);
  });

  it('rejects wrong length, non-hex, and non-strings', () => {
    expect(isValidRunId('abc')).toBe(false);
    expect(isValidRunId('g'.repeat(32))).toBe(false);
    expect(isValidRunId(RUN_A + 'a')).toBe(false);
    expect(isValidRunId(undefined)).toBe(false);
    expect(isValidRunId(null)).toBe(false);
    expect(isValidRunId(12345)).toBe(false);
  });
});

describe('decideRunMode — automatic heuristic', () => {
  it('is a fresh generate when there is no last run', () => {
    expect(
      decideRunMode({ lastRun: null, nowMs: NOW, ttlSeconds: TTL }),
    ).toEqual({ mode: 'generate' });
  });

  it('modifies a fresh, valid last run within the TTL window', () => {
    const decision = decideRunMode({
      lastRun: { runId: RUN_A, at: NOW - 60_000 }, // 1 min ago
      nowMs: NOW,
      ttlSeconds: TTL,
    });
    expect(decision).toEqual({ mode: 'modify', baseRunId: RUN_A });
  });

  it('falls back to generate when the last run is past the TTL', () => {
    const decision = decideRunMode({
      lastRun: { runId: RUN_A, at: NOW - (TTL * 1000 + 1) }, // just expired
      nowMs: NOW,
      ttlSeconds: TTL,
    });
    expect(decision).toEqual({ mode: 'generate' });
  });

  it('treats the exact TTL boundary as expired (strict <)', () => {
    const decision = decideRunMode({
      lastRun: { runId: RUN_A, at: NOW - TTL * 1000 },
      nowMs: NOW,
      ttlSeconds: TTL,
    });
    expect(decision).toEqual({ mode: 'generate' });
  });

  it('falls back to generate when the stored run id is invalid', () => {
    const decision = decideRunMode({
      lastRun: { runId: 'not-a-hex-run-id', at: NOW - 1000 },
      nowMs: NOW,
      ttlSeconds: TTL,
    });
    expect(decision).toEqual({ mode: 'generate' });
  });
});

describe('decideRunMode — explicit override', () => {
  it('honors explicit generate even with a fresh last run', () => {
    const decision = decideRunMode({
      lastRun: { runId: RUN_A, at: NOW - 1000 },
      nowMs: NOW,
      ttlSeconds: TTL,
      explicitMode: 'generate',
    });
    expect(decision).toEqual({ mode: 'generate' });
  });

  it('honors explicit modify with an explicit base run id (even if stale)', () => {
    const decision = decideRunMode({
      lastRun: { runId: RUN_A, at: NOW - (TTL * 1000 + 999_999) }, // stale
      nowMs: NOW,
      ttlSeconds: TTL,
      explicitMode: 'modify',
      explicitBaseRunId: RUN_B,
    });
    expect(decision).toEqual({ mode: 'modify', baseRunId: RUN_B });
  });

  it('explicit modify falls back to the stored run id when no explicit base', () => {
    const decision = decideRunMode({
      lastRun: { runId: RUN_A, at: NOW - 1000 },
      nowMs: NOW,
      ttlSeconds: TTL,
      explicitMode: 'modify',
    });
    expect(decision).toEqual({ mode: 'modify', baseRunId: RUN_A });
  });

  it('explicit modify degrades to generate when no valid base exists anywhere', () => {
    const decision = decideRunMode({
      lastRun: null,
      nowMs: NOW,
      ttlSeconds: TTL,
      explicitMode: 'modify',
      explicitBaseRunId: 'garbage',
    });
    expect(decision).toEqual({ mode: 'generate' });
  });

  it('ignores an unrecognised explicit mode and uses the heuristic', () => {
    const decision = decideRunMode({
      lastRun: { runId: RUN_A, at: NOW - 1000 },
      nowMs: NOW,
      ttlSeconds: TTL,
      explicitMode: 'sideways',
    });
    expect(decision).toEqual({ mode: 'modify', baseRunId: RUN_A });
  });
});

describe('decideRunMode — the model changed since the base run', () => {
  const recent = { runId: RUN_A, at: NOW - 60_000 };

  it('asks before editing the app when the model changed a lot or is another app', () => {
    for (const verdict of ['large', 'unrelated'] as const) {
      expect(
        decideRunMode({ lastRun: recent, nowMs: NOW, ttlSeconds: TTL, modelChange: change(verdict, 0.6) }),
      ).toEqual({ mode: 'modify', baseRunId: RUN_A, askUser: verdict });
    }
  });

  it('modifies without asking on a small change or an unknown one', () => {
    for (const modelChange of [change('small', 0.05), null, undefined]) {
      expect(
        decideRunMode({ lastRun: recent, nowMs: NOW, ttlSeconds: TTL, modelChange }),
      ).toEqual({ mode: 'modify', baseRunId: RUN_A });
    }
  });

  it('never asks when there is nothing to modify or the agent forced a mode', () => {
    const unrelated = change('unrelated', 1);
    expect(
      decideRunMode({ lastRun: null, nowMs: NOW, ttlSeconds: TTL, modelChange: unrelated }),
    ).toEqual({ mode: 'generate' });
    expect(
      decideRunMode({ lastRun: recent, nowMs: NOW, ttlSeconds: TTL, explicitMode: 'modify', modelChange: unrelated }),
    ).toEqual({ mode: 'modify', baseRunId: RUN_A });
  });
});

describe('resolveRunMode — the pre-run model check', () => {
  const recent = { runId: RUN_A, at: NOW - 60_000 };
  const params = { lastRun: recent, nowMs: NOW, ttlSeconds: TTL };
  const check = () => ({ project: { id: 'p' }, instructions: 'go', signal: new AbortController().signal });

  beforeEach(() => {
    vi.mocked(modelChangeService.fetchModelChange).mockReset();
    vi.mocked(confirm.globalConfirm).mockReset();
  });

  it('starts fresh only when the user picks it', async () => {
    vi.mocked(modelChangeService.fetchModelChange).mockResolvedValue(change('unrelated', 0.9));
    vi.mocked(confirm.globalConfirm).mockResolvedValue(true);
    expect(await resolveRunMode(params, check())).toEqual({ mode: 'generate' });

    vi.mocked(confirm.globalConfirm).mockResolvedValue(false);
    expect(await resolveRunMode(params, check())).toMatchObject({ mode: 'modify', baseRunId: RUN_A });
  });

  it('asks nothing on a small or unknown change, and checks nothing without a modify', async () => {
    vi.mocked(modelChangeService.fetchModelChange).mockResolvedValue(change('small', 0.05));
    expect(await resolveRunMode(params, check())).toEqual({ mode: 'modify', baseRunId: RUN_A });
    vi.mocked(modelChangeService.fetchModelChange).mockResolvedValue(null);
    expect(await resolveRunMode(params, check())).toEqual({ mode: 'modify', baseRunId: RUN_A });
    expect(confirm.globalConfirm).not.toHaveBeenCalled();

    vi.mocked(modelChangeService.fetchModelChange).mockClear();
    expect(await resolveRunMode({ ...params, lastRun: null }, check())).toEqual({ mode: 'generate' });
    expect(await resolveRunMode({ ...params, explicitMode: 'modify' }, check())).toEqual({ mode: 'modify', baseRunId: RUN_A });
    expect(modelChangeService.fetchModelChange).not.toHaveBeenCalled();
  });

  it('is null when stopped during the check or the question', async () => {
    const stop = new AbortController();
    vi.mocked(modelChangeService.fetchModelChange).mockImplementation(async () => {
      stop.abort();
      return null;
    });
    expect(await resolveRunMode(params, { ...check(), signal: stop.signal })).toBeNull();

    const stop2 = new AbortController();
    vi.mocked(modelChangeService.fetchModelChange).mockResolvedValue(change('large', 0.6));
    vi.mocked(confirm.globalConfirm).mockImplementation(async () => {
      stop2.abort();
      return false;
    });
    expect(await resolveRunMode(params, { ...check(), signal: stop2.signal })).toBeNull();
  });
});
