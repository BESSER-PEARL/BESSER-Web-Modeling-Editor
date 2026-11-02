/**
 * Code generation and local deployment (BESSER `routers/generation_router.py`,
 * `routers/deployment_router.py`). Each call returns the raw `Response`: the
 * caller reads the generated file (blob + `Content-Disposition`) or the error
 * `detail` itself. No timeout beyond the caller's `signal`.
 */
import { BACKEND_URL } from '../constants/constant';

const postJson = (path: string, body: unknown, signal?: AbortSignal): Promise<Response> =>
  fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
    },
    body: JSON.stringify(body),
    signal,
  });

/** `POST /generate-output`: one diagram (backend `DiagramInput`) in, the generated output out. */
export const generateFromDiagram = (body: unknown, signal?: AbortSignal): Promise<Response> =>
  postJson('/generate-output', body, signal);

/** `POST /generate-output-from-project`: a project (backend `ProjectInput`) in, the generated output out. */
export const generateFromProject = (project: unknown, signal?: AbortSignal): Promise<Response> =>
  postJson('/generate-output-from-project', project, signal);

/** `POST /deploy-app`: generate the app and run it on the backend host. */
export const deployApp = (body: unknown): Promise<Response> => postJson('/deploy-app', body);
