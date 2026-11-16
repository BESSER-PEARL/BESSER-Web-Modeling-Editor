/**
 * The two fields the editor sends the modeling agent with every message:
 * what the next run would use (by the run start's own rule, never the key)
 * and the project's last run with its request and whether it expired.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readGenerationKey } from '../generationKey';
import { readLastGeneration } from '../lastGeneration';
import {
  FALLBACK_SMART_GEN_CONFIG,
  peekSpecDrivenConfig,
  type SpecDrivenConfig,
} from '../../../shared/services/specDrivenConfig';
import { writeFreeTierModel, writeFreeTierSelected, writeLlmKey } from '../../../shared/services/llmKeyStorage';
import { writeProjectLastRun } from '../../../shared/services/storage/specDrivenRunRecords';
import { getDemoToken } from '../../../shared/services/demoMode';

vi.mock('../../../shared/services/specDrivenConfig', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../shared/services/specDrivenConfig')>();
  return { ...mod, peekSpecDrivenConfig: vi.fn() };
});

vi.mock('../../../shared/services/demoMode', () => ({ getDemoToken: vi.fn(() => null) }));

const config = (overrides: Partial<SpecDrivenConfig> = {}): SpecDrivenConfig => ({
  ...FALLBACK_SMART_GEN_CONFIG,
  download_ttl_seconds: 3600,
  free_tier: { ...FALLBACK_SMART_GEN_CONFIG.free_tier, available: true },
  ...overrides,
});

const RUN = 'b'.repeat(32);

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.mocked(getDemoToken).mockReturnValue(null);
  vi.mocked(peekSpecDrivenConfig).mockReturnValue(config());
});

describe('readGenerationKey', () => {
  it('names the stored key by provider and model, never the key', () => {
    writeLlmKey('anthropic', 'sk-ant-secret', 'claude-test-model');
    const key = readGenerationKey();
    expect(key).toEqual({ tier: 'own', provider: 'anthropic', model: 'claude-test-model' });
    expect(JSON.stringify(key)).not.toContain('sk-ant-secret');
  });

  it('sends a null model for the provider default', () => {
    writeLlmKey('openai', 'sk-secret');
    expect(readGenerationKey()).toEqual({ tier: 'own', provider: 'openai', model: null });
  });

  it('prefers the selected free tier over a stored key, as the run does', () => {
    writeLlmKey('openai', 'sk-secret');
    writeFreeTierSelected(true);
    writeFreeTierModel('free-model-b');
    expect(readGenerationKey()).toEqual({ tier: 'free', provider: 'free', model: 'free-model-b' });
  });

  it('is the free tier a first run defaults to when the server offers it', () => {
    expect(readGenerationKey()).toEqual({ tier: 'free', provider: 'free', model: null });
  });

  it('is none when there is no key and no free tier', () => {
    vi.mocked(peekSpecDrivenConfig).mockReturnValue(config({ free_tier: FALLBACK_SMART_GEN_CONFIG.free_tier }));
    expect(readGenerationKey()).toEqual({ tier: 'none' });
  });

  it('counts a demo link as the keyless tier', () => {
    vi.mocked(getDemoToken).mockReturnValue('demo-token');
    writeLlmKey('openai', 'sk-secret');
    expect(readGenerationKey()).toEqual({ tier: 'free', provider: 'sponsored', model: null });
  });
});

describe('readLastGeneration', () => {
  it('is absent without a recorded run', () => {
    expect(readLastGeneration('p1')).toBeUndefined();
    expect(readLastGeneration(undefined)).toBeUndefined();
  });

  it('carries the request and is not expired within the download lifetime', () => {
    writeProjectLastRun('p1', RUN, 1_000_000, 'Build a task board.');
    expect(readLastGeneration('p1', 1_000_000 + 3_599_000)).toEqual({
      runId: RUN, at: 1_000_000, expired: false, request: 'Build a task board.',
    });
  });

  it('is expired once the configured lifetime has passed', () => {
    writeProjectLastRun('p1', RUN, 1_000_000);
    expect(readLastGeneration('p1', 1_000_000 + 3_600_000)).toEqual({ runId: RUN, at: 1_000_000, expired: true });
  });
});
