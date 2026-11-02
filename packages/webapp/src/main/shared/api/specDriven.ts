/**
 * Spec-Driven Agent calls (BESSER `routers/spec_driven_router.py`) other than
 * the run stream itself, which `streamSse` (./sseClient) carries. Raw `fetch`
 * stays for the two calls the stream transport and page unload need: the
 * events page (the stream's polling fallback reads the status and body of a
 * failure into an `SseHttpError`) and the fire-and-forget cancel.
 */
import { apiClient, type ApiRequestOptions } from './api-client';
import { cancelSpecDrivenUrl, specDrivenRunEventsJsonUrl } from '../constants/constant';

const CONFIG_TIMEOUT_MS = 30_000;
/** A finished run's output can be a large zip. */
const DOWNLOAD_TIMEOUT_MS = 300_000;

/** `GET /spec-driven/config`: models, caps and features the server offers. */
export const fetchSpecDrivenConfig = () =>
  apiClient.get<unknown>('/spec-driven/config', { timeout: CONFIG_TIMEOUT_MS });

/** `POST /spec-driven/preview`: how the project's model relates to a base run's (no LLM call). */
export const previewSpecDrivenRun = (
  body: { project: unknown; instructions: string; mode: 'modify'; base_run_id: string },
  options: Pick<ApiRequestOptions, 'signal' | 'timeout'>,
) => apiClient.post<{ model_change?: unknown } | null>('/spec-driven/preview', body, options);

/** `GET /spec-driven/runs/{id}/events.json`: one page of a run's durable event log. */
export const getSpecDrivenRunEventsPage = (runId: string, afterSequence: number, signal: AbortSignal): Promise<Response> =>
  fetch(specDrivenRunEventsJsonUrl(runId, afterSequence), { signal, headers: { Accept: 'application/json' } });

/** `GET /spec-driven/download/{id}`: the run's generated output and its headers (`Content-Type`). */
export const downloadSpecDrivenOutput = (runId: string) =>
  apiClient.getBlob(`/spec-driven/download/${runId}`, { timeout: DOWNLOAD_TIMEOUT_MS });

/**
 * `POST /spec-driven/cancel/{id}`, fire-and-forget; never throws or rejects.
 * Resolves to whether the cancel was handed off (a 2xx, or the beacon queued).
 * `beacon` uses `navigator.sendBeacon` for the page-unload path (a normal fetch
 * is killed when the document is torn down); otherwise a keepalive fetch.
 */
export function cancelSpecDrivenRun(runId: string, { beacon = false }: { beacon?: boolean } = {}): Promise<boolean> {
  const url = cancelSpecDrivenUrl(runId);
  try {
    if (beacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      return Promise.resolve(navigator.sendBeacon(url));
    }
    return fetch(url, { method: 'POST', keepalive: true }).then(
      (response) => response.ok,
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}
