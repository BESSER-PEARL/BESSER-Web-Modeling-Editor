/**
 * The counter turned red ("1/8") after a single request: the colour also keyed
 * on the 1.5 s between-requests cooldown, and the status snapshot is taken
 * right after the send, so that cooldown was always non-zero.
 */
import { describe, expect, it } from 'vitest';

import { rateLimitToneClass } from '../rateLimitTone';

describe('rateLimitToneClass', () => {
  it('is neutral after one request, even while the snapshot shows the cooldown', () => {
    expect(rateLimitToneClass({ requestsLastMinute: 1, requestsLastHour: 1, cooldownRemaining: 1500 })).toBe(
      'text-muted-foreground',
    );
  });

  it('warns near the cap and is red at it', () => {
    expect(rateLimitToneClass({ requestsLastMinute: 6, requestsLastHour: 6, cooldownRemaining: 0 })).toBe('text-amber-500');
    expect(rateLimitToneClass({ requestsLastMinute: 8, requestsLastHour: 8, cooldownRemaining: 0 })).toBe('text-red-500');
  });
});
