/**
 * The assistant's rate limiter on the editor's own Node server
 * (`packages/server`, `/api/uml-agent/rate-limit/check`), not the BESSER backend.
 */

/** Ask whether a message of `messageLength` characters may be sent now. */
export const checkRateLimit = (endpoint: string, messageLength: number): Promise<Response> =>
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({ messageLength }),
  });

/** Clear this client's rate-limit window on the server. */
export const resetRateLimit = (endpoint: string): Promise<Response> =>
  fetch(endpoint, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
