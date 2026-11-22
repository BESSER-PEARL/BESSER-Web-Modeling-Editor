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
