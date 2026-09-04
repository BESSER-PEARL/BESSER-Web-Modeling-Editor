import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SMART_GEN_ENDPOINT } from '../../../../shared/constants/constant';
import { streamSse } from '../../../../shared/services/sse/sseClient';
import {
  getOrCreateAssistantSessionId,
  getPilotParticipant,
} from '../../../../shared/services/telemetry/pilotTelemetry';
import { startSpecDrivenRun } from '../specDrivenSseClient';

vi.mock('../../../../shared/services/sse/sseClient', () => ({
  streamSse: vi.fn(() => (async function* () {})()),
}));

vi.mock('../../../../shared/services/telemetry/pilotTelemetry', () => ({
  getPilotParticipant: vi.fn(() => null),
  getOrCreateAssistantSessionId: vi.fn(() => 'session-abc'),
}));

beforeEach(() => vi.clearAllMocks());

describe('startSpecDrivenRun request serialization', () => {
  it('serializes the approved from-scratch choice in snake_case', () => {
    const handle = startSpecDrivenRun({
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
      { signal: handle.controller.signal },
    );
    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.target_generator_override).toBeUndefined();
  });

  it('omits the skip flag unless it was explicitly approved', () => {
    startSpecDrivenRun({
      project: {},
      instructions: 'Build normally',
      provider: 'openai',
      apiKey: 'sk-test',
      skipDeterministicGenerator: false,
    });

    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.skip_deterministic_generator).toBeUndefined();
  });

  it('tags the request with the telemetry session + participant in pilot mode', () => {
    vi.mocked(getPilotParticipant).mockReturnValue('P3');
    vi.mocked(getOrCreateAssistantSessionId).mockReturnValue('session-abc');

    startSpecDrivenRun({
      project: {},
      instructions: 'Build the app',
      provider: 'openai',
      apiKey: 'sk-test',
    });

    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.telemetry_participant).toBe('P3');
    expect(body.telemetry_session).toBe('session-abc');
  });

  it('sends no telemetry fields outside pilot mode', () => {
    vi.mocked(getPilotParticipant).mockReturnValue(null);

    startSpecDrivenRun({
      project: {},
      instructions: 'Build the app',
      provider: 'openai',
      apiKey: 'sk-test',
    });

    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.telemetry_participant).toBeUndefined();
    expect(body.telemetry_session).toBeUndefined();
  });
});
