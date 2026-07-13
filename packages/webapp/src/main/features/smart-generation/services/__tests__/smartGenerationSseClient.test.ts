import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SMART_GEN_ENDPOINT } from '../../../../shared/constants/constant';
import { streamSse } from '../../../../shared/services/sse/sseClient';
import { startSmartGenRun } from '../smartGenerationSseClient';

vi.mock('../../../../shared/services/sse/sseClient', () => ({
  streamSse: vi.fn(() => (async function* () {})()),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

describe('startSmartGenRun request serialization', () => {
  it('serializes the approved from-scratch choice in snake_case', () => {
    const handle = startSmartGenRun({
      project: { id: 'p1' },
      instructions: 'Build from scratch',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      primaryKindOverride: 'bpmn',
      skipDeterministicGenerator: true,
    });

    expect(vi.mocked(streamSse)).toHaveBeenCalledWith(
      SMART_GEN_ENDPOINT,
      expect.objectContaining({
        primary_kind_override: 'bpmn',
        skip_deterministic_generator: true,
      }),
      { signal: handle.controller.signal, headers: {} },
    );
    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.target_generator_override).toBeUndefined();
  });

  it('omits the skip flag unless it was explicitly approved', () => {
    startSmartGenRun({
      project: {},
      instructions: 'Build normally',
      provider: 'openai',
      apiKey: 'sk-test',
      skipDeterministicGenerator: false,
    });

    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.skip_deterministic_generator).toBeUndefined();
  });

  it('authenticates the run with the current GitHub session', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: vi.fn(() => 'github-session'),
      },
    });

    startSmartGenRun({
      project: {},
      instructions: 'Build securely',
      provider: 'openai',
      apiKey: 'sk-test',
    });

    expect(vi.mocked(streamSse).mock.calls[0][2]?.headers).toEqual({
      'X-GitHub-Session': 'github-session',
    });
  });
});
