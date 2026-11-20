import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOpenLabChange,
  requestLabView,
  setOpenLabChange,
  subscribeLabViewRequests,
  subscribeOpenLabChange,
  type LabViewRequest,
} from '../labSession';

afterEach(() => setOpenLabChange(null));

describe('open lab change', () => {
  it('is null until a change is opened, then that change', () => {
    expect(getOpenLabChange()).toBeNull();
    setOpenLabChange('0123456789ab');
    expect(getOpenLabChange()).toBe('0123456789ab');
  });

  it('tells subscribers of each change of it, not of setting the same one again, until they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOpenLabChange(listener);

    setOpenLabChange('0123456789ab');
    setOpenLabChange('0123456789ab');
    setOpenLabChange(null);
    expect(listener.mock.calls).toEqual([['0123456789ab'], [null]]);

    unsubscribe();
    setOpenLabChange('ba9876543210');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('lab view requests', () => {
  const REQUEST: LabViewRequest = {
    kind: 'changes',
    changeId: '0123456789ab',
    file: { repo: 'besser', path: 'besser/x.py' },
  };

  it('reach every subscriber until it unsubscribes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeLabViewRequests(first);
    const unsubscribeSecond = subscribeLabViewRequests(second);

    requestLabView(REQUEST);
    expect(first).toHaveBeenCalledWith(REQUEST);
    expect(second).toHaveBeenCalledWith(REQUEST);

    unsubscribeFirst();
    requestLabView({ kind: 'tryIt', changeId: '0123456789ab' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    unsubscribeSecond();
  });

  it('says so in the console when no change view is open to show it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    requestLabView({ kind: 'model', changeId: '0123456789ab' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
