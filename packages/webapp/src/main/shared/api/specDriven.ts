/**
 * Spec-Driven Agent calls (BESSER `routers/spec_driven_router.py`) other than
 * the run stream itself, which `streamSse` (./sseClient) carries. Raw `fetch`
 * stays for the two calls the stream transport and page unload need: the
 * events page (the stream's polling fallback reads the status and body of a
 * failure into an `SseHttpError`) and the fire-and-forget cancel.
 */
import { apiClient, type ApiRequestOptions } from './api-client';
import { cancelSpecDrivenUrl, specDrivenRunEventsJsonUrl } from '../constants/constant';
import type { components } from './generated/besser-openapi';

export type SpecDrivenConfigResponse = components['schemas']['SpecDrivenConfigResponse'];
export type SmartPreviewResponse = components['schemas']['SmartPreviewResponse'];

const CONFIG_TIMEOUT_MS = 30_000;
/** A finished run's output can be a large zip. */
const DOWNLOAD_TIMEOUT_MS = 300_000;

/** `GET /spec-driven/config`: models, caps and features the server offers. */
export const fetchSpecDrivenConfig = () =>
  apiClient.get<SpecDrivenConfigResponse>('/spec-driven/config', { timeout: CONFIG_TIMEOUT_MS });

/** `POST /spec-driven/preview`: how the project's model relates to a base run's (no LLM call). */
export const previewSpecDrivenRun = (
  body: { project: unknown; instructions: string; mode: 'modify'; base_run_id: string },
  options: Pick<ApiRequestOptions, 'signal' | 'timeout'>,
) => apiClient.post<SmartPreviewResponse>('/spec-driven/preview', body, options);

/**
 * The header a lab run's routes (`/runs/{id}`, its events and its cancel) need: on a BESSER Lab
 * they take the lab user's GitHub session. Nothing for any other run.
 */
export const labRunHeaders = (githubSession?: string | null): Record<string, string> | undefined =>
  githubSession ? { 'X-GitHub-Session': githubSession } : undefined;

/** `GET /spec-driven/runs/{id}/events.json`: one page of a run's durable event log. */
export const getSpecDrivenRunEventsPage = (
  runId: string,
  afterSequence: number,
  signal: AbortSignal,
  githubSession?: string | null,
): Promise<Response> =>
  fetch(specDrivenRunEventsJsonUrl(runId, afterSequence), {
    signal,
    headers: { Accept: 'application/json', ...labRunHeaders(githubSession) },
  });

/** `GET /spec-driven/download/{id}`: the run's generated output and its headers (`Content-Type`). */
export const downloadSpecDrivenOutput = (runId: string) =>
  apiClient.getBlob(`/spec-driven/download/${runId}`, { timeout: DOWNLOAD_TIMEOUT_MS });

/**
 * `POST /spec-driven/cancel/{id}`, fire-and-forget; never throws or rejects.
 * Resolves to whether the cancel was handed off (a 2xx, or the beacon queued).
 * `beacon` uses `navigator.sendBeacon` for the page-unload path (a normal fetch
 * is killed when the document is torn down); otherwise a keepalive fetch.
 * `githubSession` is a lab run's (see `labRunHeaders`); a beacon cannot carry
 * it, so a lab run's cancel is always the keepalive fetch.
 */
export function cancelSpecDrivenRun(
  runId: string,
  { beacon = false, githubSession }: { beacon?: boolean; githubSession?: string | null } = {},
): Promise<boolean> {
  const url = cancelSpecDrivenUrl(runId);
  const headers = labRunHeaders(githubSession);
  try {
    if (beacon && !headers && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      return Promise.resolve(navigator.sendBeacon(url));
    }
    return fetch(url, { method: 'POST', keepalive: true, ...(headers ? { headers } : {}) }).then(
      async (response) => {
        if (!response.ok) return false;
        // `not_found` means the run had already ended: nothing was stopped.
        const body = await Promise.resolve()
          .then(() => response.json() as Promise<{ status?: string } | null>)
          .catch(() => null);
        if (body?.status === 'cancelled') acceptedCancelRunIds.add(runId);
        return true;
      },
      () => false,
    );
  } catch {
    return Promise.resolve(false);
  }
}

const acceptedCancelRunIds = new Set<string>();

/** Whether the server stopped `runId` on this tab's request (it was still running). */
export function wasSpecDrivenRunCancelAccepted(runId: string): boolean {
  return acceptedCancelRunIds.has(runId);
}
