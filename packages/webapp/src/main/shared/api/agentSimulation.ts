import { apiClient, ApiError } from './api-client';
import { BACKEND_URL } from '../constants/constant';

/**
 * API layer for the agent simulation ("Test Agent") feature.
 *
 * Every simulation HTTP call goes through the shared `apiClient` (timeouts,
 * `{"detail": ...}` error parsing into `ApiError`), and this is the single
 * place that reads the GitHub session used to authenticate against the
 * simulation endpoints and WebSocket.
 */

const GITHUB_SESSION_STORAGE_KEY = 'github_session';

/** Generating the agent and starting its container can take a while. */
const START_SESSION_TIMEOUT_MS = 120_000;
const VALIDATE_TIMEOUT_MS = 60_000;

/** Close code the backend uses when the WebSocket auth frame is rejected. */
export const AGENT_SIMULATION_WS_AUTH_FAILED_CODE = 4401;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentSimulationCredentials {
  openAiApiKey?: string;
  huggingFaceToken?: string;
  replicateApiKey?: string;
}

/** Non-secret part of a start/validate request. */
export interface AgentSimulationRequest {
  title: string;
  model: object;
  config?: object;
  configYaml?: string;
}

export interface StartAgentSimulationSessionRequest extends AgentSimulationRequest {
  credentials?: AgentSimulationCredentials;
}

export interface StartAgentSimulationSessionResponse {
  sessionId: string;
  eventList?: string[];
}

export interface ValidateAgentResponse {
  valid: boolean;
  agentCode: string;
  eventList: string[];
  errors: string[];
}

export interface AgentSimulationSessionFile {
  path: string;
  content: string;
}

export interface AgentSimulationSessionFilesResponse {
  files: AgentSimulationSessionFile[];
  directories?: string[];
}

export interface AgentSimulationLimits {
  memoryMb?: number;
  cpuCores?: number;
  diskMb?: number;
  sessionLifetimeSeconds?: number;
  editorQuotaEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** The GitHub session token, or an empty string when the user is not signed in. */
export function getGitHubSession(): string {
  try {
    return sessionStorage.getItem(GITHUB_SESSION_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function authHeaders(): Record<string, string> {
  const githubSession = getGitHubSession();
  return githubSession ? { 'X-GitHub-Session': githubSession } : {};
}

// ---------------------------------------------------------------------------
// WebSocket helpers
// ---------------------------------------------------------------------------

/** Convert an http(s) base URL into the matching ws(s) URL. */
export function toWebSocketBaseUrl(httpUrl: string | undefined): string | null {
  if (!httpUrl) return null;
  if (/^https:/i.test(httpUrl)) return httpUrl.replace(/^https:/i, 'wss:');
  if (/^http:/i.test(httpUrl)) return httpUrl.replace(/^http:/i, 'ws:');
  return null;
}

/** WebSocket URL of a simulation session, derived from BACKEND_URL. */
export function getAgentSimulationWebSocketUrl(sessionId: string, backendUrl: string | undefined = BACKEND_URL): string | null {
  const base = toWebSocketBaseUrl(backendUrl);
  return base ? `${base}/simulation/${encodeURIComponent(sessionId)}/ws` : null;
}

/** First frame sent on the simulation WebSocket; never put the session in the URL. */
export function buildAgentSimulationAuthFrame(): string {
  return JSON.stringify({ type: 'auth', githubSession: getGitHubSession() });
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * User-facing message for a failed simulation request: the backend `detail`
 * for an `ApiError`, `timeoutMessage` for a timed-out request, otherwise the
 * (already translated) `fallback`. Raw network/runtime messages are not shown.
 */
export function getAgentSimulationErrorMessage(error: unknown, fallback: string, timeoutMessage?: string): string {
  if (error instanceof ApiError) {
    return error.message && error.message !== '[object Object]' ? error.message : fallback;
  }
  const name = (error as { name?: unknown } | null)?.name;
  if (timeoutMessage && (name === 'TimeoutError' || name === 'AbortError')) return timeoutMessage;
  return fallback;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const agentSimulationApi = {
  startSession(payload: StartAgentSimulationSessionRequest): Promise<StartAgentSimulationSessionResponse> {
    return apiClient.post<StartAgentSimulationSessionResponse>('/simulation/sessions', payload, {
      headers: authHeaders(),
      timeout: START_SESSION_TIMEOUT_MS,
    });
  },

  validate(payload: AgentSimulationRequest): Promise<ValidateAgentResponse> {
    return apiClient.post<ValidateAgentResponse>('/simulation/validate', payload, {
      headers: authHeaders(),
      timeout: VALIDATE_TIMEOUT_MS,
    });
  },

  /** `keepalive` lets the request outlive the page (tab close / reload). */
  stopSession(sessionId: string, options: { keepalive?: boolean } = {}): Promise<{ ok: boolean }> {
    return apiClient.request<{ ok: boolean }>(`/simulation/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: authHeaders(),
      keepalive: options.keepalive,
    });
  },

  getSessionFiles(sessionId: string): Promise<AgentSimulationSessionFilesResponse> {
    return apiClient.get<AgentSimulationSessionFilesResponse>(
      `/simulation/sessions/${encodeURIComponent(sessionId)}/files`,
      { headers: authHeaders() },
    );
  },

  getLimits(): Promise<AgentSimulationLimits> {
    return apiClient.get<AgentSimulationLimits>('/simulation/limits', { headers: authHeaders() });
  },
};
