/**
 * besser4DT runtime kernel invocation — editor-side client.
 *
 * The editor package is shipped as ``@besser/wme`` and is meant to be
 * backend-agnostic. This helper is the single place that knows about
 * the BESSER backend's ``/runtime/invoke`` endpoint, and reads its URL
 * from a configurable global so embedders (webapp, standalone) can
 * point it at the right backend.
 *
 *   ``(globalThis as any).BESSER_RUNTIME_URL = 'https://.../besser_api';``
 *
 * Falls back to ``http://localhost:9000/besser_api`` so the standard
 * dev setup (Vite webapp on :8080, backend on :9000) just works.
 */

declare global {
  // eslint-disable-next-line no-var
  var BESSER_RUNTIME_URL: string | undefined;
}

const DEFAULT_RUNTIME_URL = 'http://localhost:9000/besser_api';

const resolveBaseUrl = (): string => {
  const fromGlobal =
    typeof globalThis !== 'undefined' && (globalThis as any).BESSER_RUNTIME_URL;
  if (typeof fromGlobal === 'string' && fromGlobal.length > 0) {
    return fromGlobal;
  }
  return DEFAULT_RUNTIME_URL;
};

export interface InvokeRequest {
  classDiagram: { title: string; model: any };
  objectDiagram: { title: string; model: any };
  className: string;
  instanceName: string;
  methodName: string;
  args?: Record<string, unknown>;
}

export interface InvokeResponse {
  instance_name: string;
  class_name: string;
  method_name: string;
  args: Record<string, unknown>;
  result: unknown;
  updated_attributes: Record<string, unknown>;
}

export class RuntimeInvokeError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`Runtime invoke failed (${status}): ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

/**
 * POST ``/runtime/invoke`` and return the parsed response.
 *
 * Throws ``RuntimeInvokeError`` for non-2xx responses with the backend's
 * ``detail`` string surfaced verbatim — callers should render that to
 * the user so they know whether the failure was a missing instance
 * (404), a missing method (422), bad kwargs (422), or a body exception
 * (500).
 */
export async function invokeMethod(request: InvokeRequest): Promise<InvokeResponse> {
  const url = `${resolveBaseUrl()}/runtime/invoke`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classDiagram: request.classDiagram,
      objectDiagram: request.objectDiagram,
      className: request.className,
      instanceName: request.instanceName,
      methodName: request.methodName,
      args: request.args ?? {},
    }),
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (body && typeof body.detail === 'string') {
        detail = body.detail;
      }
    } catch {
      // body wasn't JSON; keep the statusText fallback.
    }
    throw new RuntimeInvokeError(response.status, detail);
  }
  return (await response.json()) as InvokeResponse;
}
