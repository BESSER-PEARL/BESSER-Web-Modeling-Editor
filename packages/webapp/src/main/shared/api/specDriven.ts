/**
 * Spec-Driven Agent calls (BESSER `routers/spec_driven_router.py`) other than
 * the run stream itself, which `streamSse` (./sseClient) carries. Each call
 * returns the raw `Response`; the caller owns parsing and fallbacks.
 */
import {
  SMART_GEN_CONFIG_ENDPOINT,
  SMART_GEN_PREVIEW_ENDPOINT,
  cancelSpecDrivenUrl,
  specDrivenDownloadUrl,
  specDrivenRunEventsJsonUrl,
} from '../constants/constant';

/** `GET /spec-driven/config`: models, caps and features the server offers. */
export const getSpecDrivenConfigResponse = (): Promise<Response> => fetch(SMART_GEN_CONFIG_ENDPOINT);

/** `POST /spec-driven/preview`: how the project's model relates to a base run's (no LLM call). */
export const previewSpecDrivenRun = (
  body: { project: unknown; instructions: string; mode: 'modify'; base_run_id: string },
  signal?: AbortSignal,
): Promise<Response> =>
  fetch(SMART_GEN_PREVIEW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

/** `GET /spec-driven/runs/{id}/events.json`: one page of a run's durable event log. */
export const getSpecDrivenRunEventsPage = (runId: string, afterSequence: number, signal: AbortSignal): Promise<Response> =>
  fetch(specDrivenRunEventsJsonUrl(runId, afterSequence), { signal, headers: { Accept: 'application/json' } });

/** `GET /spec-driven/download/{id}`: the run's generated output. */
export const downloadSpecDrivenOutput = (runId: string): Promise<Response> => fetch(specDrivenDownloadUrl(runId));

/**
 * `POST /spec-driven/cancel/{id}`, fire-and-forget; never throws. `beacon`
 * uses `navigator.sendBeacon` for the page-unload path (a normal fetch is
 * killed when the document is torn down); otherwise a keepalive fetch.
 */
export function cancelSpecDrivenRun(runId: string, { beacon = false }: { beacon?: boolean } = {}): void {
  const url = cancelSpecDrivenUrl(runId);
  try {
    if (beacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url);
      return;
    }
    void fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
  } catch {
    /* best-effort */
  }
}
