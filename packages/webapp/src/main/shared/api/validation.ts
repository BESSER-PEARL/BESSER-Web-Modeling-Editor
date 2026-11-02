/** Diagram validation (BESSER `routers/validation_router.py`). */
import { apiClient } from './api-client';
import type { components } from './generated/besser-openapi';
import type { DiagramInput } from './generation';

export type ValidationResponse = components['schemas']['ValidationResponse'];

/** Validation converts the model to B-UML and runs its OCL constraints. */
const VALIDATION_TIMEOUT_MS = 120_000;

/** `POST /validate-diagram`. A failure rejects with an `ApiError`, a timeout with a `TimeoutError`. */
export const postValidateDiagram = (body: Pick<DiagramInput, 'title' | 'model'>) =>
  apiClient.post<ValidationResponse>('/validate-diagram', body, { timeout: VALIDATION_TIMEOUT_MS });
