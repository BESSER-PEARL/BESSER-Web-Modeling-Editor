import { describe, expect, it } from 'vitest';

import { FALLBACK_SMART_GEN_CONFIG } from '../specDrivenConfig';

/**
 * The fallback is used when GET /spec-driven/config is unreachable. If any
 * value UNDER-states the real backend ceiling it silently becomes the binding
 * limit in the UI and kills runs the backend would have allowed (e.g. a
 * 1200 s runtime fallback stopping runs the backend's 2400 s default allows).
 */
describe('FALLBACK_SMART_GEN_CONFIG', () => {
  const { caps } = FALLBACK_SMART_GEN_CONFIG;

  it('does not under-state the runtime default', () => {
    expect(caps.default_max_runtime_seconds).toBeGreaterThanOrEqual(2400);
  });

  it('does not under-state the cost default', () => {
    expect(caps.default_max_cost_usd).toBeGreaterThanOrEqual(5.0);
  });

  it('never lets a default exceed its own hard cap', () => {
    expect(caps.default_max_runtime_seconds).toBeLessThanOrEqual(
      caps.max_runtime_seconds_hard_cap);
    expect(caps.default_max_cost_usd).toBeLessThanOrEqual(caps.max_cost_usd_hard_cap);
  });

  it('keeps the hard caps at the backend values', () => {
    expect(caps.max_runtime_seconds_hard_cap).toBe(2400);
    expect(caps.max_cost_usd_hard_cap).toBe(5.0);
  });
});
