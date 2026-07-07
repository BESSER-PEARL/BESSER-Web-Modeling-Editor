/**
 * Unit tests for the incremental vibe-modify decision helper.
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
