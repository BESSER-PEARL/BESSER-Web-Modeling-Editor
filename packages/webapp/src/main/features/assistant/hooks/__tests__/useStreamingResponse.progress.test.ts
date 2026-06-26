/**
 * Tests for the progress-step accumulation in useStreamingResponse (#19).
 *
 * The agent streams transient `progress` lines; we accumulate the recent
 * sequence into `progressSteps` so long operations show evolving motion
 * instead of one flickering line. Critically, the list must clear the moment
 * the operation finishes (progressMessage -> '') so there is never a stuck
 * "Generating…".
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useStreamingResponse } from '../useStreamingResponse';

describe('useStreamingResponse — progressSteps (#19)', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useStreamingResponse());
    expect(result.current.progressSteps).toEqual([]);
  });

  it('accumulates the sequence of progress steps in order', () => {
    const { result } = renderHook(() => useStreamingResponse());

    act(() => result.current.setProgressMessage('Thinking…'));
    act(() => result.current.setProgressMessage('Generating classes…'));
    act(() => result.current.setProgressMessage('Building attributes…'));

    expect(result.current.progressSteps).toEqual([
      'Thinking…',
      'Generating classes…',
      'Building attributes…',
    ]);
  });

  it('ignores consecutive duplicate progress lines', () => {
    const { result } = renderHook(() => useStreamingResponse());

    act(() => result.current.setProgressMessage('Working…'));
    act(() => result.current.setProgressMessage('Working…'));

    expect(result.current.progressSteps).toEqual(['Working…']);
  });

  it('caps the list to the most recent few steps', () => {
    const { result } = renderHook(() => useStreamingResponse());

    for (const step of ['s1', 's2', 's3', 's4', 's5', 's6']) {
      act(() => result.current.setProgressMessage(step));
    }

    // Capped at 4, keeping the most recent.
    expect(result.current.progressSteps).toEqual(['s3', 's4', 's5', 's6']);
  });

  it('clears the steps when the operation finishes (no stuck "Generating…")', () => {
    const { result } = renderHook(() => useStreamingResponse());

    act(() => result.current.setProgressMessage('Generating code…'));
    expect(result.current.progressSteps).toHaveLength(1);

    // Every completion path clears progressMessage to '' — which must wipe
    // the visible step list.
    act(() => result.current.setProgressMessage(''));
    expect(result.current.progressSteps).toEqual([]);
  });
});
