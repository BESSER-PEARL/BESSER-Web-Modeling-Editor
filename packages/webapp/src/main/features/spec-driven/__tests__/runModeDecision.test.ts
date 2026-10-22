/**
 * Unit tests for the incremental modify decision helper.
 *
 * Exercises the modify-vs-fresh branching in isolation from React,
 * Redux, and the SSE client.
 */

import { describe, expect, it } from 'vitest';

import { decideRunMode, isValidRunId } from '../runModeDecision';

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
        decideRunMode({ lastRun: recent, nowMs: NOW, ttlSeconds: TTL, modelChange: { verdict, gone: 0.6, removed: [], added: [] } }),
      ).toEqual({ mode: 'modify', baseRunId: RUN_A, askUser: verdict });
    }
  });

  it('modifies without asking on a small change or an unknown one', () => {
    for (const modelChange of [{ verdict: 'small' as const, gone: 0.05, removed: [], added: [] }, null, undefined]) {
      expect(
        decideRunMode({ lastRun: recent, nowMs: NOW, ttlSeconds: TTL, modelChange }),
      ).toEqual({ mode: 'modify', baseRunId: RUN_A });
    }
  });

  it('never asks when there is nothing to modify or the agent forced a mode', () => {
    const unrelated = { verdict: 'unrelated' as const, gone: 1, removed: [], added: [] };
    expect(
      decideRunMode({ lastRun: null, nowMs: NOW, ttlSeconds: TTL, modelChange: unrelated }),
    ).toEqual({ mode: 'generate' });
    expect(
      decideRunMode({ lastRun: recent, nowMs: NOW, ttlSeconds: TTL, explicitMode: 'modify', modelChange: unrelated }),
    ).toEqual({ mode: 'modify', baseRunId: RUN_A });
  });
});
