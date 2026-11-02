/** Study telemetry (BESSER `routers/telemetry_router.py`). */
import { BACKEND_URL } from '../constants/constant';
import type { components } from './generated/besser-openapi';

export type TelemetryEventRequest = components['schemas']['TelemetryEventRequest'];

/** `POST /telemetry/event`; `keepalive` lets the request outlive a page unload. */
export const postTelemetryEvent = (event: TelemetryEventRequest): Promise<Response> =>
  fetch(`${BACKEND_URL}/telemetry/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  });
