import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupProjectStorageIntegration } from '../GraphicalUIEditor';

const makeEditor = () => {
  const handlers: Record<string, Array<() => void>> = {};
  const editor = {
    StorageManager: { add: vi.fn() },
    em: { storables: [] },
    on: (events: string, fn: () => void) => {
      events.split(' ').forEach((name) => {
        (handlers[name] ||= []).push(fn);
      });
    },
    emit: (name: string) => handlers[name]?.forEach((fn) => fn()),
    store: vi.fn(),
    getDirtyCount: vi.fn(() => 0),
  };
  return editor;
};

describe('GUI editor periodic backup save', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('skips the 30 s backup when nothing changed, saves when dirty', () => {
    const editor = makeEditor();
    const intervalRef = { current: null as NodeJS.Timeout | null };
    const timeoutRef = { current: null as NodeJS.Timeout | null };
    const cleanup = setupProjectStorageIntegration(editor as never, vi.fn(), intervalRef, timeoutRef);

    editor.emit('load');
    vi.advanceTimersByTime(2000);
    vi.advanceTimersByTime(30000);
    expect(editor.store).not.toHaveBeenCalled();

    editor.getDirtyCount.mockReturnValue(1);
    vi.advanceTimersByTime(30000);
    expect(editor.store).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('a change still triggers the debounced save', () => {
    const editor = makeEditor();
    const intervalRef = { current: null as NodeJS.Timeout | null };
    const timeoutRef = { current: null as NodeJS.Timeout | null };
    const cleanup = setupProjectStorageIntegration(editor as never, vi.fn(), intervalRef, timeoutRef);

    editor.emit('load');
    vi.advanceTimersByTime(2000);
    editor.emit('component:update');
    vi.advanceTimersByTime(2000);
    expect(editor.store).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
