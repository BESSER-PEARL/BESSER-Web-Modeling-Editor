import { describe, expect, it } from 'vitest';
import { keepRuntimeConfig, normalizeStoredPlatform } from '../runtimeConfigKeys';

const DEFAULTS = { agentPlatform: 'websocket', agentPlatformUseStreamlit: true };

describe('keepRuntimeConfig', () => {
  it('keeps the diagram runtime settings over the form copies', () => {
    const form = { agentPlatform: 'streamlit', intentRecognitionTechnology: 'classical', agentStyle: 'formal' };
    const diagram = { agentPlatform: 'telegram', intentRecognitionTechnology: 'llm-based', agentLlmName: 'gpt' };

    expect(keepRuntimeConfig(form, diagram)).toEqual({
      agentPlatform: 'telegram',
      intentRecognitionTechnology: 'llm-based',
      agentLlmName: 'gpt',
      agentStyle: 'formal',
    });
  });

  it('does not introduce a runtime key the diagram never set', () => {
    const form = { agentPlatform: 'streamlit', llm: {}, agentStyle: 'formal' };

    expect(keepRuntimeConfig(form, {})).toEqual({ agentStyle: 'formal' });
  });

  it('keeps runtime keys the form does not carry', () => {
    const merged = keepRuntimeConfig({ agentStyle: 'formal' }, { agentPlatformUseStreamlit: false });

    expect(merged).toEqual({ agentStyle: 'formal', agentPlatformUseStreamlit: false });
  });

  it('leaves the personalization settings to the form', () => {
    const merged = keepRuntimeConfig({ agentLanguage: 'german' }, { agentLanguage: 'original' });

    expect(merged.agentLanguage).toBe('german');
  });
});

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
