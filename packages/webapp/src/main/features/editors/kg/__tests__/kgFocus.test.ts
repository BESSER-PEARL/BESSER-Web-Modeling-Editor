import { afterEach, describe, expect, it, vi } from 'vitest';
import * as kgFocus from '../kgFocus';

afterEach(() => {
  // Make sure a leaked handler from a failing test doesn't bleed into the next.
  // Calling register-then-unregister with a no-op clears the singleton slot.
  const reset = kgFocus.register(() => {});
  reset();
});

describe('kgFocus', () => {
  it('forwards focus calls to the registered handler', () => {
    const handler = vi.fn();
    const unregister = kgFocus.register(handler);
    kgFocus.focus(['n1', 'n2'], { maxNeighbors: 7 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(['n1', 'n2'], { maxNeighbors: 7 });
    unregister();
  });

  it('uses default maxNeighbors=15 when caller omits it', () => {
    const handler = vi.fn();
    const unregister = kgFocus.register(handler);
    kgFocus.focus(['n1']);
    expect(handler).toHaveBeenCalledWith(['n1'], { maxNeighbors: 15 });
    unregister();
  });

  it('silently no-ops when no handler is registered', () => {
    expect(kgFocus.hasActiveHandler()).toBe(false);
    expect(() => kgFocus.focus(['n1'])).not.toThrow();
  });

  it('unregister only clears its own handler', () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const unregisterA = kgFocus.register(handlerA);
    // Registering B replaces A as the current singleton.
    const unregisterB = kgFocus.register(handlerB);
    // Unregistering A is a no-op (it's already been replaced).
    unregisterA();
    expect(kgFocus.hasActiveHandler()).toBe(true);
    kgFocus.focus(['x']);
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(handlerA).not.toHaveBeenCalled();
    unregisterB();
    expect(kgFocus.hasActiveHandler()).toBe(false);
  });
});
