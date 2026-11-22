import { describe, expect, it } from 'vitest';

import { describeCollateralRemoval, describeSkippedChanges } from '../useModelInjection';

// A partial or collateral modification used to reach only the console while the
// agent's summary still read as full success.
describe('model-injection notices', () => {
  it('names the changes that were skipped', () => {
    expect(describeSkippedChanges(2, ['add_state', 'rename'])).toBe(
      'Applied 2 of 4 requested changes; skipped: add_state, rename.',
    );
  });

  it('names classes removed without being asked', () => {
    expect(describeCollateralRemoval(['Book', 'Author'])).toContain('removed Book, Author');
  });
});
