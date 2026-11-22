import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('react-toastify', () => ({ toast }));

import { reportKgWarnings } from '../reportKgWarnings';

beforeEach(() => toast.warn.mockReset());

describe('reportKgWarnings', () => {
  it('shows each code once, however many entries repeat it', () => {
    reportKgWarnings(
      [
        { code: 'A', message: 'first A' },
        { code: 'A', message: 'second A' },
        { code: 'B', message: 'only B' },
      ],
      'kg-import',
    );

    expect(toast.warn).toHaveBeenCalledTimes(2);
    expect(toast.warn).toHaveBeenCalledWith('first A', { toastId: 'kg-import-A' });
    expect(toast.warn).toHaveBeenCalledWith('only B', { toastId: 'kg-import-B' });
  });

  it('keeps an import and a conversion warning of the same code apart', () => {
    reportKgWarnings([{ code: 'X', message: 'm' }], 'kg-import');
    reportKgWarnings([{ code: 'X', message: 'm' }], 'kg-conv');

    expect(toast.warn.mock.calls.map((c) => c[1].toastId)).toEqual(['kg-import-X', 'kg-conv-X']);
  });

  it('falls back to the code when there is no message, and ignores malformed entries', () => {
    reportKgWarnings([{ code: 'NO_TEXT' }, { message: 'no code' }, null, 'junk', { code: 7 }], 'kg-conv');

    expect(toast.warn).toHaveBeenCalledTimes(1);
    expect(toast.warn).toHaveBeenCalledWith('NO_TEXT', { toastId: 'kg-conv-NO_TEXT' });
  });

  it.each([undefined, null, 'oops', {}])('does nothing for %s', (value) => {
    reportKgWarnings(value, 'kg-conv');

    expect(toast.warn).not.toHaveBeenCalled();
  });
});
