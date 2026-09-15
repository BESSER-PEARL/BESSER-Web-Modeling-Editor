/**
 * Pilot-experiment telemetry (research data collection).
 *
 * A pilot session starts by opening the editor with `?pilot=P3` (the
 * facilitator's link). The participant label is stored for the tab and
 * attached to every telemetry event; without it NOTHING is collected —
 * regular users never produce telemetry. The backend applies its own
 * master switch on top (`BESSER_TELEMETRY_ENABLED`), so posting here is
 * always safe: the collector answers 204 whether or not it records.
 *
 * Every send is fire-and-forget: no retries, no blocking, no user-visible
 * errors. A telemetry hiccup must never affect chat or generation.
 *
 * The telemetry session id REUSES the assistant's per-tab session id (the
 * one `AssistantClient` sends on every WebSocket message), so agent-side
 * and frontend-side events for the same session land in the same store.
 * This module owns the get-or-create logic and `AssistantClient` delegates
 * to it — one id per tab, never two.
 */

import { BACKEND_URL, sessionStoragePilotParticipant } from '../../constants/constant';

/**
 * Per-tab assistant session id key. Predates the pilot experiment (hence
 * the non-`besser_` spelling) — kept stable so existing tabs keep their id.
 */
export const assistantSessionStorageKey = 'besser-assistant-session-id';

/** Participant labels are P1…Pn style tokens — never names or emails. */
const PILOT_PARTICIPANT_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;

export type TelemetryEventKind = 'prompt' | 'agent_action' | 'delivery' | 'friction';

export type DeliveryAction = 'download' | 'push_github' | 'continue_from_repo';

/**
 * Read the `pilot` URL query parameter on app load and, when it carries a
 * valid participant label, store it for the tab. Idempotent and safe to
 * call in any environment (SSR, sandboxed iframe, tests).
 */
export const initPilotModeFromUrl = (): void => {
  try {
    if (typeof window === 'undefined') return;
    const label = new URLSearchParams(window.location.search).get('pilot');
    if (label && PILOT_PARTICIPANT_PATTERN.test(label)) {
      window.sessionStorage.setItem(sessionStoragePilotParticipant, label);
    }
  } catch {
    // Storage or URL unavailable — pilot mode simply stays off.
  }
};

/**
 * The participant label for this tab, or null when pilot mode is off
 * (the overwhelmingly common case). Validated on read so a corrupted
 * stored value can never leak into a request.
 */
export const getPilotParticipant = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    const stored = window.sessionStorage.getItem(sessionStoragePilotParticipant);
    return stored && PILOT_PARTICIPANT_PATTERN.test(stored) ? stored : null;
  } catch {
    return null;
  }
};

/** True when this tab was opened through a facilitator's pilot link. */
export const isPilotSession = (): boolean => getPilotParticipant() !== null;

/**
 * Get (or create) the per-tab session id shared with the assistant
 * WebSocket protocol. `AssistantClient.createSessionId` delegates here so
 * the telemetry session and the assistant session are always the SAME id.
 */
export const getOrCreateAssistantSessionId = (): string => {
  try {
    const existing = sessionStorage.getItem(assistantSessionStorageKey);
    if (existing) return existing;
  } catch {
    // sessionStorage unavailable (e.g. iframe sandbox) — fall through
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    sessionStorage.setItem(assistantSessionStorageKey, id);
  } catch {
    // best-effort
  }
  return id;
};

/**
 * Fire-and-forget POST of one telemetry event. No-op unless pilot mode is
 * active. Never throws, never retries, never blocks the caller —
 * `keepalive` lets the request outlive a page unload (e.g. a download
 * click right before closing the tab).
 */
export const sendTelemetryEvent = (kind: TelemetryEventKind, payload: Record<string, unknown>): void => {
  try {
    const participant = getPilotParticipant();
    if (!participant || !BACKEND_URL) return;
    void fetch(`${BACKEND_URL}/telemetry/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: getOrCreateAssistantSessionId(),
        participant,
        kind,
        payload,
      }),
      keepalive: true,
    }).catch(() => {
      // Swallowed by design — telemetry can never surface an error.
    });
  } catch {
    // Swallowed by design.
  }
};

/**
 * Record a delivery action (the user actually TOOK the generated output
 * somewhere): artifact download, push to GitHub, continue-from-repo import.
 */
export const emitDeliveryEvent = (action: DeliveryAction, runId?: string): void => {
  sendTelemetryEvent('delivery', runId ? { action, runId } : { action });
};
