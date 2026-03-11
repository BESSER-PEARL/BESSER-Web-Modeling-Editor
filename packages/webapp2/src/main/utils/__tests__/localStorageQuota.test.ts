import { getLocalStorageUsageBytes } from '../localStorageQuota';

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    warning: vi.fn(),
  },
}));

describe('getLocalStorageUsageBytes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns 0 when localStorage is empty', () => {
    expect(getLocalStorageUsageBytes()).toBe(0);
  });

  it('calculates bytes correctly for a single entry', () => {
    localStorage.setItem('key', 'value');
    // "key" = 3 chars, "value" = 5 chars => 8 chars * 2 bytes = 16
    expect(getLocalStorageUsageBytes()).toBe(16);
  });

  it('sums across multiple entries', () => {
    localStorage.setItem('a', '1');
    localStorage.setItem('bb', '22');
    // "a" + "1" = 2 chars, "bb" + "22" = 4 chars => 6 * 2 = 12
    expect(getLocalStorageUsageBytes()).toBe(12);
  });

  it('handles entries with empty values', () => {
    localStorage.setItem('key', '');
    // "key" = 3 chars + "" = 0 chars => 3 * 2 = 6
    expect(getLocalStorageUsageBytes()).toBe(6);
  });
});

describe('checkLocalStorageQuota', () => {
  // The module keeps a `warningShownAt` timestamp as module-level state.
  // To get a clean slate for each test we re-import the module via
  // vi.resetModules() so that each test gets its own `warningShownAt = 0`.

  let checkLocalStorageQuota: typeof import('../localStorageQuota')['checkLocalStorageQuota'];
  let toast: { warning: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers({ now: 100_000 });

    // Re-import to reset module-level state (warningShownAt = 0)
    vi.resetModules();
    const mod = await import('../localStorageQuota');
    checkLocalStorageQuota = mod.checkLocalStorageQuota;
    const toastMod = await import('react-toastify');
    toast = toastMod.toast as any;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not show a warning when usage is below threshold', () => {
    localStorage.setItem('small', 'data');
    checkLocalStorageQuota();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('shows a warning when usage exceeds 4 MB threshold', () => {
    // 4 MB = 4 * 1024 * 1024 = 4194304 bytes
    // Each char = 2 bytes, so we need ~2,097,152 chars to cross 4 MB
    const largeValue = 'x'.repeat(2_100_000);
    localStorage.setItem('big', largeValue);

    checkLocalStorageQuota();
    expect(toast.warning).toHaveBeenCalledOnce();
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('Local storage is nearly full'),
      expect.objectContaining({ toastId: 'localStorage-quota-warning' }),
    );
  });

  it('rate-limits warnings to once per minute', () => {
    const largeValue = 'x'.repeat(2_100_000);
    localStorage.setItem('big', largeValue);

    // First call triggers a warning
    checkLocalStorageQuota();
    expect(toast.warning).toHaveBeenCalledTimes(1);

    // Call again immediately — should be suppressed by cooldown
    checkLocalStorageQuota();
    expect(toast.warning).toHaveBeenCalledTimes(1);

    // Advance past the 60-second cooldown and call again
    vi.advanceTimersByTime(61_000);
    checkLocalStorageQuota();
    expect(toast.warning).toHaveBeenCalledTimes(2);
  });
});
