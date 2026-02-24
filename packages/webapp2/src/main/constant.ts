const processEnv = typeof process !== 'undefined' ? process.env : undefined;
const runtimeEnv = import.meta.env;

const readEnv = (key: string): string | undefined => {
  const viteValue = runtimeEnv[key as keyof ImportMetaEnv];
  if (typeof viteValue === 'string' && viteValue.length > 0) {
    return viteValue;
  }
  const processValue = processEnv?.[key];
  if (typeof processValue === 'string' && processValue.length > 0) {
    return processValue;
  }
  return undefined;
};

export const APPLICATION_SERVER_VERSION = readEnv('APPLICATION_SERVER_VERSION');
export const DEPLOYMENT_URL = readEnv('DEPLOYMENT_URL');
export const BACKEND_URL = runtimeEnv.DEV ? 'http://localhost:9000/besser_api' : readEnv('BACKEND_URL');
export const SENTRY_DSN = readEnv('SENTRY_DSN');
export const POSTHOG_HOST = readEnv('POSTHOG_HOST');
export const POSTHOG_KEY = readEnv('POSTHOG_KEY');
export const BASE_URL = `${DEPLOYMENT_URL}/api`;
export const NO_HTTP_URL = DEPLOYMENT_URL?.split('//')[1] || '';
export const WS_PROTOCOL = DEPLOYMENT_URL?.startsWith('https') ? 'wss' : 'ws';

const defaultBotWsUrl = runtimeEnv.DEV
  ? 'ws://localhost:8765'
  : DEPLOYMENT_URL
    ? `${WS_PROTOCOL}://${NO_HTTP_URL}`
    : 'ws://localhost:8765';

export const UML_BOT_WS_URL = readEnv('UML_BOT_WS_URL') || defaultBotWsUrl;

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

// feature flags
export const SHOW_FULL_AGENT_CONFIGURATION = false;
export const DEFAULT_AGENT_CONFIGURATION_NAME = 'Default Agent Configuration';
export const SHOW_AGENT_PERSONALIZATION_BUTTON = false;

// Project constants
export const localStorageProjectPrefix = localStoragePrefix + 'project_';
export const localStorageLatestProject = localStoragePrefix + 'latest_project';
export const localStorageProjectsList = localStoragePrefix + 'projects';

// date formats
export const longDate = 'MMMM Do YYYY, h:mm:ss a';

// toast hide duration in ms
export const toastAutohideDelay = 2000;

// bug report url
export const bugReportURL = 'https://github.com/BESSER-PEARL/BESSER/issues/new?template=bug-report.md';
