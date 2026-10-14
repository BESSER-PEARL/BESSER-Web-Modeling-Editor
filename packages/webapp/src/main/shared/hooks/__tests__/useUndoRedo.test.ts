import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useUndoRedo } from '../useUndoRedo';

const setup = <T,>(initial: T, resetKey?: string, options?: { maxHistory?: number }) =>
  renderHook(({ k }) => useUndoRedo<T>(initial, k, options), { initialProps: { k: resetKey } });

describe('history', () => {
  it('starts with the initial state and nothing to undo or redo', () => {
    const { result } = setup(1);

    expect(result.current.state).toBe(1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('records each change and walks back and forth through them', () => {
    const { result } = setup(0);

    act(() => result.current.setState(1));
    act(() => result.current.setState(2));
    expect(result.current.state).toBe(2);

    act(() => result.current.undo());
    expect(result.current.state).toBe(1);
    act(() => result.current.undo());
    expect(result.current.state).toBe(0);
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.redo());
    act(() => result.current.redo());
    expect(result.current.state).toBe(2);
    expect(result.current.canRedo).toBe(false);
  });

  it('forgets the redo branch when something new happens after an undo', () => {
    const { result } = setup(0);
    act(() => result.current.setState(1));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.setState(5));

    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    expect(result.current.state).toBe(0);
  });

  it('does not record a change that changes nothing', () => {
    const { result } = setup(0);

    act(() => result.current.setState(0));

    expect(result.current.canUndo).toBe(false);
  });

  it('accepts an updater function', () => {
    const { result } = setup(1);

    act(() => result.current.setState((n) => n + 10));

    expect(result.current.state).toBe(11);
  });

  it('does nothing when there is nothing to undo or redo', () => {
    const { result } = setup(7);

    act(() => result.current.undo());
    act(() => result.current.redo());

    expect(result.current.state).toBe(7);
  });

  it('keeps only the most recent 100 steps by default', () => {
    const { result } = setup(0);
    for (let i = 1; i <= 150; i += 1) act(() => result.current.setState(i));

    expect(result.current.history.past).toHaveLength(100);
    expect(result.current.history.past[0]).toBe(50);
  });

  it('keeps fewer steps when asked to', () => {
    const { result } = setup(0, undefined, { maxHistory: 3 });
    for (let i = 1; i <= 10; i += 1) act(() => result.current.setState(i));

    expect(result.current.history.past).toEqual([7, 8, 9]);
  });
});

describe('changes that are not steps', () => {
  it('can replace the current state without recording a step', () => {
    const { result } = setup(0);
    act(() => result.current.setState(1));

    act(() => result.current.setState(2, { record: false }));

    expect(result.current.state).toBe(2);
    expect(result.current.history.past).toEqual([0]);
    act(() => result.current.undo());
    expect(result.current.state).toBe(0);
  });

  it('keeps the redo branch when a change is not recorded', () => {
    const { result } = setup(0);
    act(() => result.current.setState(1));
    act(() => result.current.undo());

    act(() => result.current.setState(0.5, { record: false }));

    expect(result.current.canRedo).toBe(true);
  });

  it('reset starts a new history from the given state', () => {
    const { result } = setup(0);
    act(() => result.current.setState(1));
    act(() => result.current.setState(2));
    act(() => result.current.undo());

    act(() => result.current.reset(99));

    expect(result.current.state).toBe(99);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});

describe('resetting from outside (the quantum editor relies on this)', () => {
  it('goes back to the initial state, with no history, when the reset key changes', () => {
    const { result, rerender } = setup(0, 'a');
    act(() => result.current.setState(1));

    rerender({ k: 'b' });

    expect(result.current.state).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it('keeps the history while the reset key stays the same', () => {
    const { result, rerender } = setup(0, 'a');
    act(() => result.current.setState(1));

    rerender({ k: 'a' });

    expect(result.current.state).toBe(1);
    expect(result.current.canUndo).toBe(true);
  });

  it('restarts when the initial state itself is replaced', () => {
    const { result, rerender } = renderHook(({ initial }) => useUndoRedo(initial), { initialProps: { initial: 1 } });
    act(() => result.current.setState(2));

    rerender({ initial: 10 });

    expect(result.current.state).toBe(10);
    expect(result.current.canUndo).toBe(false);
  });
});
