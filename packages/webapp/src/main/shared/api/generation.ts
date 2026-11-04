/**
 * Code generation and local deployment (BESSER `routers/generation_router.py`,
 * `routers/deployment_router.py`). A failure rejects with an `ApiError`; a
 * timeout with a `TimeoutError` `DOMException`.
 */
import { apiClient } from './api-client';
import type { components, operations } from './generated/besser-openapi';

export type DiagramInput = components['schemas']['DiagramInput'];

/** `docker compose up` builds the app's images first: a hung request is the only thing this stops. */
const DEPLOY_TIMEOUT_MS = 30 * 60_000;

const ACCEPT_ANY = { Accept: 'application/json, text/plain, */*' };

/** `POST /generate-output`: one diagram in, the generated file and its headers (`Content-Disposition`) out. */
export const generateFromDiagram = (body: DiagramInput, timeout: number) =>
  apiClient.downloadBlob('/generate-output', body, { headers: ACCEPT_ANY, timeout });

/**
 * `POST /generate-output-from-project`: a project (backend `ProjectInput`) in,
 * the generated file and its headers out. Typed `unknown`: the editor builds
 * the payload as a plain record (`buildProjectPayloadForBackend`).
 */
export const generateFromProject = (project: unknown, timeout: number) =>
  apiClient.downloadBlob('/generate-output-from-project', project, { headers: ACCEPT_ANY, timeout });

/** `POST /deploy-app`: generate the app and run it on the backend host. */
export const deployApp = (body: DiagramInput) =>
  apiClient.post<null>('/deploy-app', body, { headers: ACCEPT_ANY, timeout: DEPLOY_TIMEOUT_MS });

/** The open JSON object (`Dict[str, Any]`) the recommendation and personalization routes take. */
type OpenJsonBody =
  operations['recommend_agent_config_mapping_besser_api_recommend_agent_config_mapping_post']['requestBody']['content']['application/json'];

/** These routes declare no response model; the caller checks the fields it reads. */
export interface AgentConfigRecommendation {
  config?: unknown;
  matchedRules?: unknown;
  signals?: unknown;
}

/** An LLM rewrites the page for the profile. */
const PERSONALIZE_TIMEOUT_MS = 600_000;

/** `POST /recommend-agent-config-mapping`: an agent configuration from the rules that match a user profile. */
export const recommendAgentConfigMapping = (body: OpenJsonBody, githubSession: string) =>
  apiClient.post<AgentConfigRecommendation>('/recommend-agent-config-mapping', body, {
    headers: { 'X-GitHub-Session': githubSession },
  });

/** `POST /recommend-agent-config-llm`: an agent configuration an LLM proposes for a user profile. */
export const recommendAgentConfigLlm = (body: OpenJsonBody, githubSession: string) =>
  apiClient.post<Pick<AgentConfigRecommendation, 'config'>>('/recommend-agent-config-llm', body, {
    headers: { 'X-GitHub-Session': githubSession },
  });

/**
 * `POST /personalize-gui-page`: a GUI page rewritten for a user profile. No response
 * model in the schema: `guiPage` is the page snapshot the caller validates.
 */
export const personalizeGuiPage = <Snapshot>(body: OpenJsonBody) =>
  apiClient.post<{ guiPage?: Snapshot }>('/personalize-gui-page', body, { timeout: PERSONALIZE_TIMEOUT_MS });
