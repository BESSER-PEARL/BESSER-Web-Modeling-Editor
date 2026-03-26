import { BACKEND_URL } from '../constants/constant';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

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
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new ApiError(response.status, error.detail || 'Request failed');
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** POST JSON payload and return parsed response. */
  async post<T>(endpoint: string, data: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** GET request with parsed JSON response. */
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Upload a FormData payload (e.g. file uploads).
   *
   * Note: Content-Type is intentionally omitted so the browser sets
   * the correct multipart boundary automatically.
   */
  async upload<T>(endpoint: string, formData: FormData, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // No Content-Type header — the browser sets it with the boundary
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new ApiError(response.status, error.detail || 'Upload failed');
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * POST JSON and receive a raw Blob (e.g. ZIP file downloads).
   */
  async downloadBlob(endpoint: string, data: unknown, options?: RequestInit): Promise<Blob> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(data),
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
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
