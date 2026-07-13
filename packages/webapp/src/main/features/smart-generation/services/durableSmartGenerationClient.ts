import {
  cancelDurableSmartGenUrl,
  sessionStorageSmartGenIdempotencyPrefix,
  SMART_GEN_RUNS_ENDPOINT,
  smartGenRunEventsUrl,
} from '../../../shared/constants/constant';
import { SseHttpError } from '../../../shared/services/sse/sseClient';
import { githubSessionHeaders } from '../../../shared/utils/githubSessionHeaders';
import type { SmartGenEvent } from '../types';
import type {
  SmartGenRunHandle,
  StartSmartGenRunParams,
} from './smartGenerationSseClient';

interface DurableRunResponse {
  run_id: string;
  status: string;
}

interface DurableIdempotencyRecord {
  key: string;
  fingerprint: string;
}

const RUN_ID_RE = /^[a-f0-9]{32}$/i;
const TERMINAL_ERROR_CODES = new Set([
  'INVALID_KEY',
  'UPSTREAM_LLM',
  'INTERNAL',
  'BAD_REQUEST',
  'QUOTA',
  'CANCELLED',
]);

function requestBody(params: StartSmartGenRunParams): Record<string, unknown> {
  const usesBaseUrl = params.provider === 'pia' || params.provider === 'local';
  const body: Record<string, unknown> = {
    project: params.project,
    instructions: params.instructions,
    api_key: params.apiKey,
    provider: usesBaseUrl ? 'openai' : params.provider,
  };
  if (usesBaseUrl && params.baseUrl) body.base_url = params.baseUrl;
  if (params.llmModel) body.llm_model = params.llmModel;
  if (typeof params.maxCostUsd === 'number') body.max_cost_usd = params.maxCostUsd;
  if (typeof params.maxRuntimeSeconds === 'number') {
    body.max_runtime_seconds = params.maxRuntimeSeconds;
  }
  if (params.mode) body.mode = params.mode;
  if (params.baseRunId) body.base_run_id = params.baseRunId;
  if (params.primaryKindOverride) {
    body.primary_kind_override = params.primaryKindOverride;
  }
  if (params.targetGeneratorOverride) {
    body.target_generator_override = params.targetGeneratorOverride;
  }
  if (params.skipDeterministicGenerator === true) {
    body.skip_deterministic_generator = true;
  }
  return body;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `smartgen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function projectId(params: StartSmartGenRunParams): string {
  if (params.project && typeof params.project === 'object') {
    const id = (params.project as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return 'unscoped';
}

function requestFingerprint(body: Record<string, unknown>): string {
  const value = JSON.stringify({ ...body, api_key: undefined });
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

function idempotencyRecord(
  params: StartSmartGenRunParams,
  body: Record<string, unknown>,
): { key: string; storageKey: string } {
  const storageKey = `${sessionStorageSmartGenIdempotencyPrefix}${projectId(params)}`;
  const fingerprint = requestFingerprint(body);
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<DurableIdempotencyRecord>;
      if (
        typeof stored.key === 'string' &&
        stored.key.length >= 8 &&
        stored.fingerprint === fingerprint
      ) {
        return { key: stored.key, storageKey };
      }
    }
    const key = newIdempotencyKey();
    window.sessionStorage.setItem(storageKey, JSON.stringify({ key, fingerprint }));
    return { key, storageKey };
  } catch {
    return { key: newIdempotencyKey(), storageKey };
  }
}

function clearIdempotencyRecord(storageKey: string, expectedKey: string): void {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return;
    const stored = JSON.parse(raw) as Partial<DurableIdempotencyRecord>;
    if (stored.key === expectedKey) window.sessionStorage.removeItem(storageKey);
  } catch {
    // Storage is best-effort; backend idempotency remains authoritative.
  }
}

async function responseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function reconnectDelay(attempt: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.min(500 * 2 ** attempt, 5000)),
  );
}

async function* readDurableEvents(
  runId: string,
  signal: AbortSignal,
  onTerminal: () => void,
): AsyncGenerator<SmartGenEvent, void, void> {
  let lastEventId = '';
  let reconnectAttempt = 0;

  while (!signal.aborted) {
    let response: Response;
    try {
      response = await fetch(smartGenRunEventsUrl(runId), {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'text/event-stream',
          ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
          ...githubSessionHeaders(),
        },
        signal,
      });
    } catch {
      if (signal.aborted) return;
      reconnectAttempt += 1;
      await reconnectDelay(reconnectAttempt);
      continue;
    }

    if (!response.ok) {
      throw new SseHttpError(response.status, await responseText(response));
    }
    if (!response.body) {
      throw new SseHttpError(response.status, 'Response had no body stream');
    }

    reconnectAttempt = 0;
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        buffer += done
          ? decoder.decode()
          : decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          let frameId = '';
          const dataLines: string[] = [];
          for (const line of frame.split(/\r?\n/)) {
            if (line.startsWith('id:')) frameId = line.slice(3).trim();
            if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
          }
          if (frameId) lastEventId = frameId;
          if (dataLines.length === 0) continue;
          let event: SmartGenEvent;
          try {
            event = JSON.parse(dataLines.join('\n')) as SmartGenEvent;
          } catch {
            continue;
          }
          yield event;
          if (
            event.event === 'done' ||
            (event.event === 'error' && TERMINAL_ERROR_CODES.has(event.code))
          ) {
            onTerminal();
            return;
          }
        }
        if (done) break;
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // The reader may already be closed by the proxy.
      }
    }

    if (!signal.aborted) {
      reconnectAttempt += 1;
      await reconnectDelay(reconnectAttempt);
    }
  }
}

/**
 * Enqueue detached work, then follow its replayable event stream. Network
 * disconnects reconnect with Last-Event-ID; only abort requests cancellation.
 */
export async function startDurableSmartGenRun(
  params: StartSmartGenRunParams,
): Promise<SmartGenRunHandle> {
  const controller = new AbortController();
  const body = requestBody(params);
  const idempotency = idempotencyRecord(params, body);
  const response = await fetch(SMART_GEN_RUNS_ENDPOINT, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': idempotency.key,
      ...githubSessionHeaders(),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  if (!response.ok) {
    throw new SseHttpError(response.status, await responseText(response));
  }
  const queued = (await response.json()) as Partial<DurableRunResponse>;
  if (typeof queued.run_id !== 'string' || !RUN_ID_RE.test(queued.run_id)) {
    throw new Error('Durable SmartGen returned an invalid run id');
  }

  const runId = queued.run_id.toLowerCase();
  let terminal = false;
  const markTerminal = () => {
    terminal = true;
    clearIdempotencyRecord(idempotency.storageKey, idempotency.key);
  };
  const events = readDurableEvents(runId, controller.signal, markTerminal);
  const abort = () => {
    if (!terminal) {
      void fetch(cancelDurableSmartGenUrl(runId), {
        method: 'POST',
        credentials: 'include',
        headers: githubSessionHeaders(),
      }).catch(() => undefined);
    }
    controller.abort();
  };
  return { events, abort, controller, runId };
}
