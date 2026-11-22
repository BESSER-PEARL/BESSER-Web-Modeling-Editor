/** The backend's own description (BESSER `backend.py`, `GET /besser_api/`). */
import { apiClient } from './api-client';
import type { components } from './generated/besser-openapi';

export type ApiInfo = components['schemas']['ApiInfoResponse'];

/** `GET /besser_api/`: the BESSER version the backend runs and its generators. */
export const getApiInfo = (timeout: number) => apiClient.get<ApiInfo>('/', { timeout });
