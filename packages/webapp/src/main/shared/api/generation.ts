/**
 * Code generation and local deployment (BESSER `routers/generation_router.py`,
 * `routers/deployment_router.py`). A failure rejects with an `ApiError`; a
 * timeout with a `TimeoutError` `DOMException`.
 */
import { apiClient } from './api-client';
import type { components } from './generated/besser-openapi';

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
