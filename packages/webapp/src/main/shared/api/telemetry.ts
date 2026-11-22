/** Study telemetry (BESSER `routers/telemetry_router.py`). */
import { apiClient } from './api-client';
import type { components } from './generated/besser-openapi';

export type TelemetryEventRequest = components['schemas']['TelemetryEventRequest'];

/** `POST /telemetry/event`; `keepalive` lets the request outlive a page unload. A failure rejects. */
export const postTelemetryEvent = (event: TelemetryEventRequest) =>
  apiClient.post<unknown>('/telemetry/event', event, { keepalive: true });
