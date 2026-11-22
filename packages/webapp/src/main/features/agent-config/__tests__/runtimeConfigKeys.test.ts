import { describe, expect, it } from 'vitest';
import { normalizeStoredPlatform } from '../runtimeConfigKeys';

const DEFAULTS = { agentPlatform: 'websocket', agentPlatformUseStreamlit: true };

describe('normalizeStoredPlatform', () => {
  it('reads the legacy streamlit platform as websocket with the Streamlit UI', () => {
    expect(normalizeStoredPlatform('streamlit', false, DEFAULTS)).toEqual({
      agentPlatform: 'websocket',
      agentPlatformUseStreamlit: true,
    });
  });

  it('keeps a valid platform and its flag', () => {
    expect(normalizeStoredPlatform('telegram', false, DEFAULTS)).toEqual({
      agentPlatform: 'telegram',
      agentPlatformUseStreamlit: false,
    });
  });

  it('falls back to the defaults when nothing is stored', () => {
    expect(normalizeStoredPlatform(undefined, undefined, DEFAULTS)).toEqual(DEFAULTS);
  });
});
