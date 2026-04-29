/**
 * Read an environment variable at build time.
 *
 * Vite's `define` replaces **static** `process.env.X` references with literal
 * strings during the build.  A dynamic lookup like `process.env[key]` is NOT
 * replaced, so each variable must be accessed by its full static name.
 *
 * The helper below checks the Vite-injected value first, then falls back to
 * `import.meta.env` (useful during SSR or when `VITE_`-prefixed vars are used).
 */
const _env = (viteValue: string | undefined, metaValue: string | undefined): string | undefined => {
  if (typeof viteValue === 'string' && viteValue.length > 0) return viteValue;
  if (typeof metaValue === 'string' && metaValue.length > 0) return metaValue;
  return undefined;
};

export const APPLICATION_SERVER_VERSION = _env(process.env.APPLICATION_SERVER_VERSION, import.meta.env.VITE_APPLICATION_SERVER_VERSION);
export const DEPLOYMENT_URL = _env(process.env.DEPLOYMENT_URL, import.meta.env.VITE_DEPLOYMENT_URL);
export const BACKEND_URL = import.meta.env.DEV
  ? 'http://localhost:9000/besser_api'
  : _env(process.env.BACKEND_URL, import.meta.env.VITE_BACKEND_URL);
export const SENTRY_DSN = _env(process.env.SENTRY_DSN, import.meta.env.VITE_SENTRY_DSN);
export const POSTHOG_HOST = _env(process.env.POSTHOG_HOST, import.meta.env.VITE_POSTHOG_HOST);
export const POSTHOG_KEY = _env(process.env.POSTHOG_KEY, import.meta.env.VITE_POSTHOG_KEY);
export const BASE_URL = `${DEPLOYMENT_URL}/api`;
export const NO_HTTP_URL = DEPLOYMENT_URL?.split('//')[1] || '';
export const WS_PROTOCOL = DEPLOYMENT_URL?.startsWith('https') ? 'wss' : 'ws';

const defaultBotWsUrl = import.meta.env.DEV
  ? 'ws://localhost:8765'
  : DEPLOYMENT_URL
    ? `${WS_PROTOCOL}://${NO_HTTP_URL}`
    : 'ws://localhost:8765';

export const UML_BOT_WS_URL = _env(process.env.UML_BOT_WS_URL, import.meta.env.VITE_UML_BOT_WS_URL) || defaultBotWsUrl;

// prefixes
export const localStoragePrefix = 'besser_';
export const localStorageDiagramPrefix = localStoragePrefix + 'diagram_';

// keys
export const localStorageDiagramsList = localStoragePrefix + 'diagrams';
export const localStorageLatest = localStoragePrefix + 'latest';
export const localStorageCollaborationName = localStoragePrefix + 'collaborationName';
export const localStorageCollaborationColor = localStoragePrefix + 'collaborationColor';
export const localStorageUserThemePreference = localStoragePrefix + 'userThemePreference';
export const localStorageSystemThemePreference = localStoragePrefix + 'systemThemePreference';
export const localStorageUserProfiles = localStoragePrefix + 'userProfiles';
export const localStorageAgentConfigurations = localStoragePrefix + 'agentConfigs';
export const localStorageAgentProfileMappings = localStoragePrefix + 'agentProfileMappings';
export const localStorageActiveAgentConfiguration = localStoragePrefix + 'agentActiveConfig';
export const localStorageAgentBaseModels = localStoragePrefix + 'agentBaseModels';
/**
 * @deprecated since v7.3.0 — kept for the cleanup migration only. Agent
 * runtime config (platform, intent-recognition technology, LLM
 * provider/model) now lives on the agent diagram itself
 * (`AgentDiagram.config`). The v3 storage migration deletes this top-level
 * key when present; do not read or write it.
 */
export const localStorageSystemConfig = localStoragePrefix + 'systemConfig';

// per-project deploy linkage (suffix: `<projectId>_<target>`)
export const localStorageDeployLinkedRepoPrefix = localStoragePrefix + 'deploy_linked_';

// external service URLs
export const RENDER_DEPLOY_URL_BASE = 'https://render.com/deploy';

// feature flags
export const SHOW_FULL_AGENT_CONFIGURATION = false;
export const DEFAULT_AGENT_CONFIGURATION_NAME = 'Default Agent Configuration';
export const SHOW_AGENT_PERSONALIZATION_BUTTON = false;

// Project constants
export const localStorageProjectPrefix = localStoragePrefix + 'project_';
export const localStorageLatestProject = localStoragePrefix + 'latest_project';
export const localStorageProjectsList = localStoragePrefix + 'projects';

// Smart Generator — BYOK session-storage keys.
// The raw API key is stored ONLY in sessionStorage (tab-lifetime, cleared on
// tab close). It is never written to localStorage or Redux state.
export const sessionStorageSmartGenApiKey = localStoragePrefix + 'smart_gen_api_key';
export const sessionStorageSmartGenProvider = localStoragePrefix + 'smart_gen_provider';
// Optional model override alongside the key. Empty / missing means "use
// the backend default for this provider" (gpt-4o for openai,
// claude-sonnet-4-6 for anthropic).
export const sessionStorageSmartGenLlmModel = localStoragePrefix + 'smart_gen_llm_model';

// Smart Generator backend endpoints (derived from BACKEND_URL).
export const SMART_GEN_ENDPOINT = `${BACKEND_URL}/smart-generate`;
export const smartGenDownloadUrl = (runId: string): string =>
  `${BACKEND_URL}/download-smart/${runId}`;

// date formats
export const longDate = 'MMMM Do YYYY, h:mm:ss a';

// toast hide duration in ms
export const toastAutohideDelay = 2000;

// bug report url
export const bugReportURL = 'https://github.com/BESSER-PEARL/BESSER/issues/new?template=bug-report.md';
