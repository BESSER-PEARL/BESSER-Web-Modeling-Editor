import type { RateLimitStatus } from '../services/RateLimiterService';

/**
 * Text colour for the "n/8" requests-per-minute counter. Red only at the cap:
 * the status is a snapshot taken right after each send, so its 1.5 s
 * between-requests cooldown was always non-zero and turned "1/8" red.
 */
export function rateLimitToneClass(status: RateLimitStatus): string {
  if (status.requestsLastMinute >= 8) return 'text-red-500';
  if (status.requestsLastMinute >= 6) return 'text-amber-500';
  return 'text-muted-foreground';
}
