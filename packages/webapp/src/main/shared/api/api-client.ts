import { BACKEND_URL } from '../constants/constant';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Per-request options. Extends `RequestInit` with an optional `timeout`
 * (milliseconds) that overrides the client's default for slow endpoints
 * (e.g. GitHub deployment, code generation).
 */
export type ApiRequestOptions = RequestInit & { timeout?: number };

/** Build the DOMException used as the abort reason on timeout. */
const timeoutReason = (ms: number) =>
  new DOMException(`Request timed out after ${ms}ms`, 'TimeoutError');

/**
 * Readable text for the `detail` of a FastAPI error body. A handled error
 * sends a string; a request-validation failure (422) sends a list of
 * `{loc, msg, type}` objects, which used to reach the user as
 * "[object Object]". Each entry becomes "field.path: message"; the `body`
 * prefix every body field carries is left out.
 */
export function formatErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail || fallback;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (!item || typeof item !== 'object') return item == null ? '' : String(item);
        const { loc, msg } = item as { loc?: unknown; msg?: unknown };
        const where = Array.isArray(loc) ? loc.filter((p, i) => !(i === 0 && p === 'body')).join('.') : '';
        const text = typeof msg === 'string' && msg ? msg : JSON.stringify(item);
        return where ? `${where}: ${text}` : text;
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join('; ') : fallback;
  }
  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message;
    return typeof message === 'string' && message ? message : JSON.stringify(detail);
  }
  return fallback;
}

/** The `ApiError` for a failed response, from its `{"detail": ...}` body when
 *  there is one, else from its status text, else `fallback`. */
async function errorFromResponse(response: Response, fallback: string): Promise<ApiError> {
  const body = await response.json().catch(() => ({ detail: response.statusText }));
  const detail = body && typeof body === 'object' ? (body as { detail?: unknown }).detail : undefined;
  return new ApiError(response.status, formatErrorDetail(detail, fallback));
}

/**
 * Centralized API client for all backend communication.
 *
 * Provides a single place to configure base URL, timeouts, default headers,
 * and error handling instead of scattering raw `fetch()` calls across the
 * codebase.  Existing call-sites can be migrated incrementally.
 */
class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl = BACKEND_URL ?? '', timeout = DEFAULT_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Generic request helper.  All other convenience methods delegate here.
   *
   * Header precedence: caller-supplied headers in ``options.headers`` are
   * merged FIRST, then ``Content-Type: application/json`` is applied LAST so
   * the JSON content-type cannot be silently clobbered by a call-site that
   * only meant to add an auth header. Pass ``Content-Type`` explicitly in
   * ``options.headers`` only if you really want a different content type
   * (e.g. ``multipart/form-data`` — but for FormData prefer ``upload()``,
   * which omits Content-Type so the browser sets the boundary).
   */
  async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { timeout: timeoutOverride, ...fetchOptions } = options;
    const timeoutMs = timeoutOverride ?? this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(timeoutReason(timeoutMs)), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          ...fetchOptions.headers,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw await errorFromResponse(response, 'Request failed');
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** POST JSON payload and return parsed response. */
  async post<T>(endpoint: string, data: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** GET request with parsed JSON response. */
  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Upload a FormData payload (e.g. file uploads).
   *
   * Note: Content-Type is intentionally omitted so the browser sets
   * the correct multipart boundary automatically.
   */
  async upload<T>(endpoint: string, formData: FormData, options?: ApiRequestOptions): Promise<T> {
    const { timeout: timeoutOverride, ...fetchOptions } = options ?? {};
    const timeoutMs = timeoutOverride ?? this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(timeoutReason(timeoutMs)), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // No Content-Type header — the browser sets it with the boundary
      });

      if (!response.ok) {
        throw await errorFromResponse(response, 'Upload failed');
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * POST JSON and receive a raw Blob (e.g. ZIP file downloads).
   */
  async downloadBlob(endpoint: string, data: unknown, options?: ApiRequestOptions): Promise<Blob> {
    const { timeout: timeoutOverride, ...fetchOptions } = options ?? {};
    const timeoutMs = timeoutOverride ?? this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(timeoutReason(timeoutMs)), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        method: 'POST',
        body: JSON.stringify(data),
        signal: controller.signal,
        headers: {
          ...fetchOptions.headers,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new ApiError(response.status, 'Download failed');
      }

      return response.blob();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * POST JSON and receive a file together with its response headers (e.g.
   * `Content-Disposition`, which carries the server-chosen file name).
   *
   * Unlike {@link downloadBlob}, a failure raises an {@link ApiError} carrying
   * the server's `{"detail": ...}` explanation instead of a generic message.
   */
  async downloadFile(
    endpoint: string,
    data: unknown,
    options?: ApiRequestOptions,
  ): Promise<{ blob: Blob; headers: Headers }> {
    const { timeout: timeoutOverride, ...fetchOptions } = options ?? {};
    const timeoutMs = timeoutOverride ?? this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(timeoutReason(timeoutMs)), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        method: 'POST',
        body: JSON.stringify(data),
        signal: controller.signal,
        headers: {
          ...fetchOptions.headers,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw await errorFromResponse(response, 'Download failed');
      }

      return { blob: await response.blob(), headers: response.headers };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/** Typed error class carrying the HTTP status code. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Singleton instance configured with the project's BACKEND_URL. */
export const apiClient = new ApiClient();
export default apiClient;
