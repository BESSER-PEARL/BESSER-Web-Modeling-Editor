// webpack environment constants
export const APPLICATION_SERVER_VERSION = process.env.APPLICATION_SERVER_VERSION;
export const DEPLOYMENT_URL = process.env.DEPLOYMENT_URL;
export const BACKEND_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:9000/besser_api' 
  : process.env.BACKEND_URL;
export const SENTRY_DSN = process.env.SENTRY_DSN;
export const POSTHOG_HOST = process.env.POSTHOG_HOST;
export const POSTHOG_KEY = process.env.POSTHOG_KEY;
export const BASE_URL = `${DEPLOYMENT_URL}/api`;
export const NO_HTTP_URL = DEPLOYMENT_URL?.split('//')[1] || '';
export const WS_PROTOCOL = DEPLOYMENT_URL?.startsWith('https') ? 'wss' : 'ws';

const defaultBotWsUrl = process.env.NODE_ENV === 'development'
  ? 'ws://localhost:8765'
  : DEPLOYMENT_URL
    ? `${WS_PROTOCOL}://${NO_HTTP_URL}`
    : 'ws://localhost:8765';

export const UML_BOT_WS_URL = process.env.UML_BOT_WS_URL || defaultBotWsUrl;

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
