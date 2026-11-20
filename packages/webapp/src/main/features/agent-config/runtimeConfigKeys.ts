/**
 * The Runtime tab owns these settings and stores them on the agent diagram's `config`.
 * The personalization form keeps its own stale copy of some of them (its `agentPlatform`
 * defaults to the legacy `'streamlit'`, which the Platform dropdown has no option for),
 * so writing the form back over the diagram config would reset or blank them.
 */
export const RUNTIME_CONFIG_KEYS = [
  'agentPlatform',
  'agentPlatformUseStreamlit',
  'intentRecognitionTechnology',
  'agentLlmProvider',
  'agentLlmModel',
  'agentCustomLlmModel',
  'agentLlmName',
  'llm',
] as const;

/**
 * `nextConfig` (the personalization form) with every runtime key taken from
 * `previousConfig` (the diagram's current config). A runtime key the diagram never set
 * stays unset, so the Runtime tab keeps showing its default instead of the form's copy.
 */
export const keepRuntimeConfig = (
  nextConfig: Record<string, unknown>,
  previousConfig: Record<string, unknown>,
): Record<string, unknown> => {
  const merged = { ...nextConfig };
  for (const key of RUNTIME_CONFIG_KEYS) {
    if (key in previousConfig) {
      merged[key] = previousConfig[key];
    } else {
      delete merged[key];
    }
  }
  return merged;
};

/** The Platform dropdown offers websocket and telegram; the legacy `'streamlit'` is websocket with the Streamlit UI. */
export const normalizeStoredPlatform = (
  platform: unknown,
  useStreamlit: unknown,
  defaults: { agentPlatform: string; agentPlatformUseStreamlit: boolean },
): { agentPlatform: string; agentPlatformUseStreamlit: boolean } => {
  if (platform === 'streamlit') {
    return { agentPlatform: 'websocket', agentPlatformUseStreamlit: true };
  }
  return {
    agentPlatform: typeof platform === 'string' && platform ? platform : defaults.agentPlatform,
    agentPlatformUseStreamlit: typeof useStreamlit === 'boolean' ? useStreamlit : defaults.agentPlatformUseStreamlit,
  };
};
