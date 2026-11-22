import { beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmValidationWarnings } from '../confirmValidationWarnings';
import { globalConfirm } from '../../confirm/globalConfirm';

vi.mock('../../confirm/globalConfirm', () => ({ globalConfirm: vi.fn() }));

describe('confirmValidationWarnings', () => {
  beforeEach(() => vi.mocked(globalConfirm).mockReset());

  it('goes ahead without asking when there is nothing to warn about', async () => {
    await expect(confirmValidationWarnings(undefined)).resolves.toBe(true);
    await expect(confirmValidationWarnings([])).resolves.toBe(true);
    expect(globalConfirm).not.toHaveBeenCalled();
  });

  it("asks once, names the first warnings without the backend's emoji, and returns the answer", async () => {
    vi.mocked(globalConfirm).mockResolvedValue(false);

    const answer = await confirmValidationWarnings(['⚠️ A has no attributes', 'B is unused', 'C is unused', 'D is unused', 'E is unused']);

    expect(answer).toBe(false);
    expect(globalConfirm).toHaveBeenCalledTimes(1);
    const options = vi.mocked(globalConfirm).mock.calls[0][0];
    expect(options.title).toBe('The model has 5 validation warnings');
    expect(options.description).toBe(
      'Generate anyway, or fix the model first? A has no attributes · B is unused · C is unused …and 2 more.',
    );
    expect(options.confirmLabel).toBe('Generate anyway');
    expect(options.cancelLabel).toBe('Fix the model first');
  });

  it('uses the singular for one warning', async () => {
    vi.mocked(globalConfirm).mockResolvedValue(true);
    await expect(confirmValidationWarnings(['A has no attributes'])).resolves.toBe(true);
    expect(vi.mocked(globalConfirm).mock.calls[0][0].title).toBe('The model has a validation warning');
  });
});
