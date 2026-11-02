/** Diagram validation (BESSER `routers/validation_router.py`). */
import { BACKEND_URL } from '../constants/constant';

/**
 * `POST /validate-diagram`: the raw `Response` (a `ValidationResponse`, or
 * `{errors}` on failure). The caller owns the timeout through `signal`.
 */
export const postValidateDiagram = (body: { title: string; model: unknown }, signal?: AbortSignal): Promise<Response> =>
  fetch(`${BACKEND_URL}/validate-diagram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
