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
 * Per-user default chosen on the first-run landing: `'model'` (low-code
 * canvas) or `'agent'` (agentic assistant). When set, the first-run flow skips
 * the mode-chooser and opens that workspace directly. Written only when the
 * user ticks "Remember my choice".
 */
export const localStoragePreferredInterface = localStoragePrefix + 'preferred_interface';
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

// Unified LLM BYOK session-storage keys — ONE key for the whole app.
// The user's Anthropic / OpenAI / Mistral key is stored ONLY in sessionStorage
// (tab-lifetime, cleared on tab close), never in localStorage or Redux. A
// single shared key means the user enters it in ONE place (the shared BYOK
// dialog, reachable from the assistant drawer, the assistant popup, and the
// Settings page) and it applies to BOTH the assistant/modeling-agent AND the
// Spec-Driven (smart) generator. The old per-feature keys used to be kept
// separate for isolation; they were unified so the key is entered once.
export const sessionStorageLlmApiKey = localStoragePrefix + 'llm_api_key';
export const sessionStorageLlmProvider = localStoragePrefix + 'llm_provider';
export const sessionStorageLlmModel = localStoragePrefix + 'llm_model';
// OpenAI-compatible base URL for the 'local' provider (user-supplied, e.g.
// http://localhost:11434/v1 for Ollama) and the 'pia' provider (the fixed LIST
// gateway, see PIA_GATEWAY_BASE_URL). Empty/missing = use the backend's own
// default (its OPENAI_BASE_URL env, or the SDK default).
export const sessionStorageLlmBaseUrl = localStoragePrefix + 'llm_base_url';

// The LIST PIA gateway (OpenAI-compatible). The frontend sends this as the base
// URL for the 'pia' provider so a PIA run reaches the gateway regardless of the
// backend's OPENAI_BASE_URL env. Only reachable from the LIST VPN — i.e. when
// the WME backend runs locally on-VPN. Not a secret (public gateway host).
export const PIA_GATEWAY_BASE_URL = 'https://gateway.pia.private.list.lu/v1';

// Smart Generator — BYOK keys now alias the unified keys above (kept as named
// exports so existing imports keep working with no consumer changes).
export const sessionStorageSpecDrivenApiKey = sessionStorageLlmApiKey;
export const sessionStorageSpecDrivenProvider = sessionStorageLlmProvider;
export const sessionStorageSpecDrivenLlmModel = sessionStorageLlmModel;
// User-chosen run budget (NOT secret — still session-scoped so it sits
// next to the key/model it applies to). Values are plain numbers
// serialised as strings: USD for cost, whole seconds for runtime.
export const sessionStorageSpecDrivenMaxCostUsd = localStoragePrefix + 'smart_gen_max_cost_usd';
export const sessionStorageSpecDrivenMaxRuntimeSeconds =
  localStoragePrefix + 'smart_gen_max_runtime_seconds';
// Keyless "Free" tier opt-in for smart-gen. The free tier uses a server-hosted
// open-weight model and needs NO API key, so it must NOT be represented by
// writing a placeholder into the unified LLM key above — that store is SHARED
// with the assistant, and a fake key would break the assistant's own calls.
// This dedicated flag records the opt-in independently. Value: '1' when set.
export const sessionStorageSpecDrivenFreeTier = localStoragePrefix + 'smart_gen_free_tier';
// Explicitly chosen free-tier model id. Stored ONLY when the user picked the
// server's non-default (fallback/self-hosted) free model; absent = the server's
// default. Kept apart from the unified LLM model key above for the same reason
// as the free flag — that store is shared with the assistant's BYOK settings.
export const sessionStorageSpecDrivenFreeModel = localStoragePrefix + 'smart_gen_free_model';

// AI Assistant — BYOK keys also alias the unified keys above, so entering the
// key via the assistant fills the same store the smart generator reads.
export const sessionStorageAssistantApiKey = sessionStorageLlmApiKey;
export const sessionStorageAssistantProvider = sessionStorageLlmProvider;
export const sessionStorageAssistantModel = sessionStorageLlmModel;

// Pilot-experiment participant label (research telemetry).
// Set on app load from the facilitator's `?pilot=P3` link and scoped to the
// tab (sessionStorage): every telemetry event this tab produces carries the
// label so the pilot report can group by participant. Regular sessions never
// have this key and produce no telemetry. Value: `P1`…`Pn` style labels
// matching ^[A-Za-z0-9_-]{1,16}$ — never a name or email.
export const sessionStoragePilotParticipant = localStoragePrefix + 'pilot_participant';

// "Describe your app" (vibe) hand-off key.
// The Project Hub's Describe flow stashes the user's plain-language prompt here,
// then closes and hands off to the assistant. The assistant consumes-and-clears
// it exactly once — after it has mounted AND its WebSocket is connected — and
// auto-submits it so the agent starts building immediately. Session-scoped so it
// never survives a tab close; the one-shot consume guards against replaying a
// stale prompt.
export const sessionStoragePendingAssistantPrompt = localStoragePrefix + 'pending_assistant_prompt';

// Set when an "agentic" project is created (or when the app is opened with
// ?agentic): WorkspaceShell consumes-and-clears it once a project is loaded to
// open the assistant drawer automatically (no prompt is auto-sent).
export const sessionStorageOpenAssistantOnLoad = localStoragePrefix + 'open_assistant_on_load';

// Smart Generator — per-project last successful run id (incremental vibe-modify).
// When a vibe-generation run finishes, its run_id is stashed here keyed by
// project so a follow-up "add feature X" can send `mode:'modify'` +
// `base_run_id` and edit the existing app in place instead of rebuilding —
// as long as the run is still within the backend's download TTL. Stored in
// localStorage (not sessionStorage) so it survives a reload. Suffix: `<projectId>`.
export const localStorageSpecDrivenLastRunPrefix = localStoragePrefix + 'smartgen_lastrun_';

// Smart-generation "Push to GitHub" connect-first intent.
// When the user clicks "Push to GitHub" on a finished vibe-generation card but
// isn't signed in yet, we stash ``{ runId, projectId }`` here and kick off the
// GitHub OAuth redirect. After the redirect back, the push hook consumes this
// (once, for the matching project) and reopens the push dialog for that run.
export const sessionStorageSpecDrivenPushIntent = localStoragePrefix + 'smart_gen_push_intent';

// "Continue from GitHub" connect-first intent.
// When the user picks "Continue from GitHub" in the Project Hub but isn't signed
// in yet, we stash this flag and kick off the GitHub OAuth redirect. After the
// redirect back, the Project Hub bootstrap keeps the hub open and the hub jumps
// straight to the GitHub repo picker (consuming-and-clearing this flag once).
export const sessionStorageContinueFromGithubIntent = localStoragePrefix + 'continue_from_github_intent';

// Smart Generator backend endpoints (derived from BACKEND_URL).
export const SMART_GEN_ENDPOINT = `${BACKEND_URL}/spec-driven/generate`;
export const SMART_GEN_PREVIEW_ENDPOINT = `${BACKEND_URL}/spec-driven/preview`;
export const SMART_GEN_CONFIG_ENDPOINT = `${BACKEND_URL}/spec-driven/config`;
export const specDrivenDownloadUrl = (runId: string): string =>
  `${BACKEND_URL}/spec-driven/download/${runId}`;
export const cancelSpecDrivenUrl = (runId: string): string =>
  `${BACKEND_URL}/spec-driven/cancel/${runId}`;

// date formats
export const longDate = 'MMMM Do YYYY, h:mm:ss a';

// toast hide duration in ms
export const toastAutohideDelay = 2000;

// bug report repository ("owner/repo") — the single place to retarget issue reporting
export const bugReportRepo = 'BESSER-PEARL/BESSER';
export const bugReportURL = `https://github.com/${bugReportRepo}/issues/new?template=bug-report.md`;
