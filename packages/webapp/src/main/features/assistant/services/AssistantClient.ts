import type {
  ActionHandler,
  AgentResponse,
  AssistantActionPayload,
  AssistantClientMode,
  AssistantClientOptions,
  AssistantWorkspaceContext,
  ChatMessage,
  ConnectionHandler,
  DiagramSummary,
  InjectionCommand,
  InjectionHandler,
  MessageHandler,
  ProjectMetadata,
  SendStatus,
  TypingHandler,
} from './assistant-types';
import { ProtocolError } from './errors';
import { readAssistantApiKey } from './byokStorage';

interface FileAttachmentPayload {
  filename: string;
  content: string; // base64-encoded
  mimeType: string;
}

type QueuedMessage =
  {
    kind: 'text';
    clientMessageId: string;
    message: string;
    diagramType: string;
    context?: Partial<AssistantWorkspaceContext>;
    attachments?: FileAttachmentPayload[];
  }
  | {
    kind: 'voice';
    clientMessageId: string;
    audioBase64: string;
    mimeType: string;
    diagramType: string;
    context?: Partial<AssistantWorkspaceContext>;
  };

const SESSION_STORAGE_KEY = 'besser-assistant-session-id';
const USER_ID_STORAGE_KEY = 'besser_assistant_user_id';

const getStableUserId = (): string => {
  // BAF's websocket platform keys backend sessions on the `user_id`
  // query param; without a stable id every reconnect creates a brand-new
  // backend session, wiping conversation memory and pending flow state
  // (and re-running the greeting). Persisted in localStorage so the id
  // survives tab and browser restarts (create once, reuse forever).
  try {
    const existing = localStorage.getItem(USER_ID_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // localStorage unavailable (e.g. iframe sandbox) — fall through
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    localStorage.setItem(USER_ID_STORAGE_KEY, id);
  } catch {
    // best-effort
  }
  return id;
};

const withStableUserParam = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('user_id')) {
      parsed.searchParams.set('user_id', getStableUserId());
    }
    return parsed.toString();
  } catch {
    // Non-absolute/invalid URL — append conservatively
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}user_id=${encodeURIComponent(getStableUserId())}`;
  }
};

const createSessionId = (): string => {
  // Reuse the session ID within the same browser tab so that closing
  // and reopening the assistant drawer reconnects to the same backend
  // session (preserving conversation memory and context).
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // sessionStorage unavailable (e.g. iframe sandbox) — fall through
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // best-effort
  }
  return id;
};

const createMessageId = (): string => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const KNOWN_ACTIONS = new Set([
  'assistant_message',
  'inject_element',
  'inject_complete_system',
  'modify_model',
  'switch_diagram',
  'create_diagram_tab',
  'trigger_generator',
  'trigger_smart_generator',
  'trigger_export',
  'trigger_deploy',
  'auto_generate_gui',
  'agent_error',
  'progress',
  'stream_start',
  'stream_chunk',
  'stream_done',
]);

// Actions with real side effects: they mutate the user's model or start a
// (possibly paid, BYOK-billed) backend run. They must only be honoured when
// they arrive as the WHOLE structured reply — never when scraped out of prose.
// Otherwise a prompt-injected JSON blob inside an otherwise-normal assistant
// message could silently mutate the model or kick off a paid generation.
// (Security hardening — assistant review finding C1c.)
const SIDE_EFFECT_ACTIONS = new Set([
  'inject_element',
  'inject_complete_system',
  'modify_model',
  'trigger_generator',
  'trigger_smart_generator',
  'trigger_export',
  'trigger_deploy',
  'auto_generate_gui',
]);

const isActionPayload = (payload: unknown): payload is AssistantActionPayload => {
  if (!isObject(payload)) {
    return false;
  }
  if (typeof payload.action !== 'string') {
    return false;
  }
  return KNOWN_ACTIONS.has(payload.action);
};

const isSideEffectAction = (payload: unknown): boolean =>
  isObject(payload) && typeof payload.action === 'string' && SIDE_EFFECT_ACTIONS.has(payload.action);

const isInjectionCommand = (payload: unknown): payload is InjectionCommand => {
  if (!isObject(payload) || typeof payload.action !== 'string') {
    return false;
  }
  return ['inject_element', 'inject_complete_system', 'modify_model'].includes(payload.action);
};

const mergeContexts = (
  base: AssistantWorkspaceContext | undefined,
  override: Partial<AssistantWorkspaceContext> | undefined,
  fallbackDiagramType: string,
): AssistantWorkspaceContext => {
  const activeDiagramType = override?.activeDiagramType || base?.activeDiagramType || fallbackDiagramType || 'ClassDiagram';
  return {
    activeDiagramType,
    activeDiagramId: override?.activeDiagramId || base?.activeDiagramId,
    projectSnapshot: override?.projectSnapshot || base?.projectSnapshot,
    projectName: override?.projectName || base?.projectName,
    diagramSummaries: override?.diagramSummaries || base?.diagramSummaries || [],
    projectMetadata: override?.projectMetadata || base?.projectMetadata,
    currentDiagramIndices: override?.currentDiagramIndices || base?.currentDiagramIndices,
  };
};

const stripRedundantProjectMetadata = (projectSnapshot: unknown): any | undefined => {
  if (!isObject(projectSnapshot)) {
    return undefined;
  }

  const snapshot = { ...projectSnapshot } as Record<string, any>;
  if (!isObject(snapshot.diagrams)) {
    return snapshot;
  }

  const cleanedDiagrams: Record<string, any> = {};
  Object.entries(snapshot.diagrams).forEach(([diagramType, diagramPayload]) => {
    // Handle array of diagrams (v2 schema)
    if (Array.isArray(diagramPayload)) {
      cleanedDiagrams[diagramType] = diagramPayload.map((d: any) => {
        if (!isObject(d)) return d;
        const cleaned = { ...d } as Record<string, any>;
        delete cleaned.lastUpdate;
        return cleaned;
      });
      return;
    }
    if (!isObject(diagramPayload)) {
      cleanedDiagrams[diagramType] = diagramPayload;
      return;
    }
    const normalizedDiagramPayload = { ...diagramPayload } as Record<string, any>;
    if ('lastUpdate' in normalizedDiagramPayload) {
      delete normalizedDiagramPayload.lastUpdate;
    }
    cleanedDiagrams[diagramType] = normalizedDiagramPayload;
  });
  snapshot.diagrams = cleanedDiagrams;
  return snapshot;
};

// --- Diagram summary helpers ---

const buildDiagramSummary = (diagram: any, diagramType: string, diagramId?: string): DiagramSummary => {
  if (!diagram?.model) return { type: diagramType, diagramId, empty: true };

  const model = diagram.model;

  // For UML-style models (Class, Object, StateMachine, Agent) that have elements & relationships
  if (model.elements && model.relationships) {
    const elements = Object.values(model.elements) as any[];
    const relationships = Object.values(model.relationships) as any[];

    // Group elements by their type field
    const elementsByType: Record<string, string[]> = {};
    for (const el of elements) {
      const type = el.type || 'unknown';
      if (!elementsByType[type]) elementsByType[type] = [];
      if (el.name) elementsByType[type].push(el.name);
    }

    const summary: DiagramSummary = {
      type: diagramType,
      diagramId,
      elementCount: elements.length,
      relationshipCount: relationships.length,
      elementsByType,
    };

    // For ClassDiagrams include class names so cross-diagram references are easy to resolve
    if (diagramType === 'ClassDiagram') {
      summary.classNames = elements.filter((e: any) => e.type === 'Class').map((e: any) => e.name);
    }

    return summary;
  }

  return { type: diagramType, diagramId, elementCount: 0 };
};

const buildDiagramSummaries = (projectSnapshot: unknown): DiagramSummary[] => {
  if (!isObject(projectSnapshot) || !isObject(projectSnapshot.diagrams)) {
    return [];
  }
  const summaries: DiagramSummary[] = [];
  Object.entries(projectSnapshot.diagrams).forEach(([diagramType, diagramPayload]) => {
    if (Array.isArray(diagramPayload)) {
      diagramPayload.forEach((d: any, index: number) => {
        summaries.push(buildDiagramSummary(d, diagramType, d?.id ?? `${diagramType}_${index}`));
      });
    } else if (isObject(diagramPayload)) {
      summaries.push(buildDiagramSummary(diagramPayload, diagramType));
    }
  });
  return summaries;
};

const buildProjectMetadata = (projectSnapshot: unknown): ProjectMetadata | undefined => {
  if (!isObject(projectSnapshot) || !isObject(projectSnapshot.diagrams)) {
    return undefined;
  }
  const diagrams = projectSnapshot.diagrams as Record<string, any>;
  let totalDiagrams = 0;
  const diagramTypes: string[] = [];
  Object.entries(diagrams).forEach(([type, payload]) => {
    if (Array.isArray(payload)) {
      if (payload.length > 0) {
        totalDiagrams += payload.length;
        diagramTypes.push(type);
      }
    } else if (payload) {
      totalDiagrams += 1;
      diagramTypes.push(type);
    }
  });
  return { totalDiagrams, diagramTypes };
};

const compactContextPayload = (context: AssistantWorkspaceContext): AssistantWorkspaceContext => {
  const compacted: AssistantWorkspaceContext = { ...context };
  const compactProjectSnapshot = stripRedundantProjectMetadata(context.projectSnapshot);
  if (compactProjectSnapshot) {
    compacted.projectSnapshot = compactProjectSnapshot;
  }

  // Always build and include diagram summaries and project metadata -- these are
  // compact enough to keep even when stripping heavier payloads for bandwidth.
  if (!compacted.diagramSummaries || compacted.diagramSummaries.length === 0) {
    const summaries = buildDiagramSummaries(compacted.projectSnapshot);
    if (summaries.length > 0) {
      compacted.diagramSummaries = summaries;
    }
  }

  if (!compacted.projectMetadata) {
    const metadata = buildProjectMetadata(compacted.projectSnapshot);
    if (metadata) {
      compacted.projectMetadata = metadata;
    }
  }

  return compacted;
};

export class AssistantClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private connectingPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private readonly baseReconnectDelay = 2000;
  private readonly maxReconnectDelay = 30000;
  private readonly maxReconnectAttempts = 8;
  private messageQueue: QueuedMessage[] = [];
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private _drainAborted = false;
  private _drainRunning = false;
  private _nextClientMessageId = 1;
  private shouldReconnect = true;
  private responseTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly responseTimeoutMs = 45000;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatMs = 15000;

  private readonly clientMode: AssistantClientMode;
  private sessionId: string;
  // Mutable so a shared (singleton) client can be re-pointed at the live
  // workspace context by whichever surface is currently mounted, instead of
  // going stale when the creating surface unmounts.
  private contextProvider?: () => AssistantWorkspaceContext | undefined;

  // Multi-subscriber handlers so a SINGLE shared client can feed BOTH the
  // floating widget and the workspace drawer (one socket, one session id).
  // Previously each surface created its own client → two sockets sharing one
  // session id, which collided in BAF's reply routing.
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly connectionHandlers = new Set<ConnectionHandler>();
  private readonly typingHandlers = new Set<TypingHandler>();
  private readonly injectionHandlers = new Set<InjectionHandler>();
  private readonly actionHandlers = new Set<ActionHandler>();

  private emitMessage(m: ChatMessage): void { this.messageHandlers.forEach((h) => h(m)); }
  private emitConnection(c: boolean): void { this.connectionHandlers.forEach((h) => h(c)); }
  private emitTyping(t: boolean): void { this.typingHandlers.forEach((h) => h(t)); }
  private emitInjection(i: InjectionCommand): void { this.injectionHandlers.forEach((h) => h(i)); }
  private emitAction(a: AssistantActionPayload): void { this.actionHandlers.forEach((h) => h(a)); }

  constructor(private readonly url: string = 'ws://localhost:8765', options: AssistantClientOptions = {}) {
    this.clientMode = options.clientMode || 'widget';
    this.sessionId = options.sessionId || createSessionId();
    this.contextProvider = options.contextProvider;
  }

  /** Re-point the (possibly shared) client at the live workspace-context source. */
  setContextProvider(provider: () => AssistantWorkspaceContext | undefined): void {
    this.contextProvider = provider;
  }

  connect(): Promise<void> {
    if (this.isConnected) {
      return Promise.resolve();
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING && this.connectingPromise) {
      return this.connectingPromise;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.isConnected = true;
      return Promise.resolve();
    }

    this.shouldReconnect = true;
    this.connectingPromise = new Promise((resolve, reject) => {
      try {
        // Stable per-browser user id → BAF reuses the same backend
        // session across reconnects (memory and pending flows survive).
        this.ws = new WebSocket(withStableUserParam(this.url));
        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          this.emitConnection(true);
          this.startHeartbeat();
          // Re-arm the user's BYOK key on a fresh socket so the agent's
          // session variable is restored after a reconnect / reclaimed slot.
          // Sent BEFORE draining the queue so any queued user message is
          // processed with the key already in place.
          this.rearmUserApiKey();
          this.processMessageQueue();
          this.connectingPromise = null;
          resolve();
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.stopHeartbeat();
          this.connectingPromise = null;
          this.emitTyping(false);
          this.emitConnection(false);
          if (this.shouldReconnect) {
            this.attemptReconnect();
          } else {
            this.reconnectAttempts = 0;
          }
        };

        this.ws.onerror = (error) => {
          console.error('Assistant WebSocket error:', error);
          this.isConnected = false;
          this.connectingPromise = null;
          this.emitTyping(false);
          this.emitConnection(false);
          if (this.shouldReconnect) {
            this.attemptReconnect();
          }
          reject(error);
        };

        this.ws.onmessage = (event) => this.handleMessage(event);
      } catch (error) {
        this.connectingPromise = null;
        reject(error);
      }
    });

    return this.connectingPromise;
  }

  disconnect(options: { allowReconnect?: boolean; clearQueue?: boolean } = {}): void {
    this.shouldReconnect = options.allowReconnect ?? false;
    // Abort any in-flight async drain loop immediately.
    this._drainAborted = true;
    this.clearResponseTimer();
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try {
        this.ws.close();
      } catch (error) {
        console.warn('Error closing assistant websocket', error);
      }
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.connectingPromise = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    if (options.clearQueue) {
      this.messageQueue = [];
    }
    this.emitTyping(false);
    this.emitConnection(false);
  }

  sendMessage(
    message: string,
    diagramType?: string,
    context?: Partial<AssistantWorkspaceContext>,
    attachments?: FileAttachmentPayload[],
  ): SendStatus {
    const type = diagramType || 'ClassDiagram';
    if (!this.isConnected || !this.ws) {
      this.enqueueMessage({ kind: 'text', clientMessageId: '', message, diagramType: type, context, attachments });
      return 'queued';
    }
    try {
      this.sendPayload(this.buildUserPayload(message, type, context, attachments));
      return 'sent';
    } catch (error) {
      console.error('Failed to send assistant message', error);
      return 'error';
    }
  }

  sendVoiceMessage(
    audioBase64: string,
    mimeType: string = 'audio/wav',
    diagramType?: string,
    context?: Partial<AssistantWorkspaceContext>,
  ): SendStatus {
    const type = diagramType || 'ClassDiagram';
    if (!this.isConnected || !this.ws) {
      this.enqueueMessage({ kind: 'voice', clientMessageId: '', audioBase64, mimeType, diagramType: type, context });
      return 'queued';
    }
    try {
      this.sendPayload(this.buildVoicePayload(audioBase64, mimeType, type, context));
      return 'sent';
    } catch (error) {
      console.error('Failed to send assistant voice message', error);
      return 'error';
    }
  }

  sendFrontendEvent(
    eventType: string,
    payload: { ok?: boolean; message?: string; metadata?: Record<string, any> } = {},
  ): SendStatus {
    if (!this.isConnected || !this.ws) {
      return 'error';
    }
    try {
      const actionPayload = {
        action: 'frontend_event',
        protocolVersion: '2.0',
        clientMode: this.clientMode,
        sessionId: this.sessionId,
        eventType,
        ok: payload.ok,
        message: payload.message,
        metadata: payload.metadata,
      };
      this.sendPayload(actionPayload);
      return 'sent';
    } catch (error) {
      console.error('Failed to send frontend event', error);
      return 'error';
    }
  }

  /**
   * Send the user's bring-your-own-key (BYOK) API key to the agent as a
   * `user_set_variable` message — the same lightweight channel the heartbeat
   * and voice-context use (an action the agent already handles, no LLM
   * trigger). The agent reads session variables `user_api_key`,
   * `user_api_provider`, and `user_api_model` to route the conversation
   * through the user's own key.
   *
   * Pass an empty `apiKey` to CLEAR it on the agent side (sends just
   * `{ user_api_key: '' }`).
   *
   * Returns 'sent' when delivered, 'error' when the socket is down — in which
   * case the key still lives in sessionStorage, so the next (re)connect
   * re-arms it automatically via `rearmUserApiKey()`. The key is NEVER logged.
   */
  setUserApiKey(params: { apiKey: string; provider?: string; model?: string }): SendStatus {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return 'error';
    }
    try {
      const message: Record<string, string> = { user_api_key: params.apiKey };
      // Only attach provider/model when actually setting a key — a clear
      // sends the bare `{ user_api_key: '' }`.
      if (params.apiKey) {
        if (params.provider) message.user_api_provider = params.provider;
        if (params.model) message.user_api_model = params.model;
      }
      this.ws.send(
        JSON.stringify({
          action: 'user_set_variable',
          user_id: this.sessionId,
          message,
        }),
      );
      return 'sent';
    } catch {
      // Never log the key — even on failure.
      return 'error';
    }
  }

  /**
   * Re-send the stored BYOK key (if any) right after a (re)connect so the
   * agent's session variable survives a fresh socket / reclaimed reply slot.
   * Best-effort and silent — never logs the key.
   */
  private rearmUserApiKey(): void {
    try {
      const stored = readAssistantApiKey();
      if (!stored) return;
      this.setUserApiKey({ apiKey: stored.apiKey, provider: stored.provider, model: stored.model });
    } catch {
      // best-effort — a failed re-arm just means the user re-saves the key
    }
  }

  // Each onX adds a subscriber and returns an unsubscribe fn, so one surface
  // unmounting removes only ITS handlers (not the other surface's).
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onTyping(handler: TypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  onInjection(handler: InjectionHandler): () => void {
    this.injectionHandlers.add(handler);
    return () => this.injectionHandlers.delete(handler);
  }

  onAction(handler: ActionHandler): () => void {
    this.actionHandlers.add(handler);
    return () => this.actionHandlers.delete(handler);
  }

  /** Remove ALL subscribers — full teardown only, never per-surface. */
  clearHandlers(): void {
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
    this.typingHandlers.clear();
    this.injectionHandlers.clear();
    this.actionHandlers.clear();
  }

  /**
   * Start a fresh conversation session. The backend keys conversation memory
   * on the payload `sessionId`, so reusing it across projects/chats leaks
   * memory (the agent "remembers" a previous project). Regenerating the id
   * here means subsequent messages start a clean agent memory. The WebSocket
   * itself (keyed on the stable per-browser `user_id`) is left intact — only
   * the sessionId carried in future payloads changes. Call on project switch
   * and on "new chat".
   */
  resetSession(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // sessionStorage unavailable — fall through to a fresh in-memory id
    }
    this.sessionId = createSessionId();
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get connectionState(): string {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'unknown';
    }
  }

  private buildUserPayload(
    message: string,
    diagramType: string,
    contextOverride?: Partial<AssistantWorkspaceContext>,
    attachments?: FileAttachmentPayload[],
  ): Record<string, any> {
    const baseContext = this.contextProvider?.();
    const context = compactContextPayload(
      mergeContexts(baseContext, contextOverride, diagramType),
    );
    const payload: Record<string, any> = {
      action: 'user_message',
      protocolVersion: '2.0',
      clientMode: this.clientMode,
      sessionId: this.sessionId,
      message,
      context,
    };
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }
    return payload;
  }

  private buildWirePayload(payload: Record<string, any>): Record<string, any> {
    if (payload.action === 'user_voice') {
      // Voice messages need the audio as the raw `message` for the BESSER
      // framework's speech-to-text pipeline.  We send the workspace context
      // as a USER_SET_VARIABLE message right before the audio so the agent
      // knows what's on the canvas.  See sendPayload() for the send order.
      return {
        action: 'user_voice',
        user_id: this.sessionId,
        message: payload.message,
        // Stash context so sendPayload can send it as a preceding message
        _voiceContext: payload.context,
      };
    }

    // BESSER WebSocketPlatform only preserves `action`, `message`, `user_id`, `history`.
    // Keep v2 payload intact by serializing it into `message`.
    return {
      action: 'user_message',
      user_id: this.sessionId,
      message: JSON.stringify(payload),
    };
  }

  private sendPayload(payload: Record<string, any>): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket is not connected');
    }
    const wire = this.buildWirePayload(payload);

    // For voice messages, send the workspace context as a USER_SET_VARIABLE
    // message right before the audio so the agent knows what's on the canvas.
    // The agent reads session variable '_voice_context' when parsing voice events.
    const voiceCtx = wire._voiceContext;
    delete wire._voiceContext; // Always clean up to prevent leaking into wire JSON
    if (voiceCtx && typeof voiceCtx === 'object') {
      const contextSyncPayload = {
        action: 'user_set_variable',
        user_id: this.sessionId,
        message: { _voice_context: voiceCtx },
      };
      this.ws.send(JSON.stringify(contextSyncPayload));
    }

    this.ws.send(JSON.stringify(wire));
    this.emitTyping(true);
    this.startResponseTimer();
  }

  private buildVoicePayload(
    audioBase64: string,
    mimeType: string,
    diagramType: string,
    contextOverride?: Partial<AssistantWorkspaceContext>,
  ): Record<string, any> {
    const baseContext = this.contextProvider?.();
    const context = compactContextPayload(
      mergeContexts(baseContext, contextOverride, diagramType),
    );
    return {
      action: 'user_voice',
      protocolVersion: '2.0',
      clientMode: this.clientMode,
      sessionId: this.sessionId,
      message: audioBase64,
      mimeType,
      context,
    };
  }

  private handleMessage(event: MessageEvent): void {
    this.clearResponseTimer();
    try {
      const payload = JSON.parse(event.data) as AgentResponse;
      const directAction = this.extractActionPayload(payload);

      // A 'progress' frame is an intermediate keep-alive emitted DURING a
      // long generation — it is NOT the reply. Keep the "thinking…"
      // indicator on for the whole run and re-arm the response-timeout
      // safety net for the actual reply. The old code cleared typing on
      // EVERY incoming frame, so the first progress update (~2s into a
      // ~45s generation) hid the loading indicator for the rest of the run
      // and the socket looked idle — the "I didn't get a loading message"
      // report. Keeping isGenerating true also blocks a concurrent send
      // while a generation is still in flight.
      if (directAction && directAction.action === 'progress') {
        this.startResponseTimer();
        this.emitAction(directAction);
        return;
      }

      this.emitTyping(false);
      if (directAction) {
        if (isInjectionCommand(directAction)) {
          this.emitInjection({
            ...directAction,
            message:
              typeof directAction.message === 'string'
                ? directAction.message
                : payload.message && typeof payload.message === 'string'
                  ? payload.message
                  : 'Applied assistant update.',
          });
          // Don't fire the action handler for injection commands —
          // they are fully processed by the injection handler above.
          // Firing both would enqueue duplicate tasks in the drawer.
        } else {
          this.emitAction(directAction);
        }

        if (directAction.action === 'assistant_message' && typeof directAction.message === 'string') {
          const chatMessage: ChatMessage = {
            id: createMessageId(),
            action: directAction.action,
            message: directAction.message,
            isUser: false,
            timestamp: new Date(),
            diagramType: typeof directAction.diagramType === 'string' ? directAction.diagramType : payload.diagramType,
          };
          this.emitMessage(chatMessage);        
        }
        return;
      }
      
      // Received user messages correspond to audio transcriptions
      const chatMessage: ChatMessage = {
        id: createMessageId(),
        action: payload.action,
        message: payload.action === 'user_message' ? '📢 ' + payload.message : payload.message,
        isUser: payload.action === 'user_message',
        timestamp: new Date(),
        diagramType: payload.diagramType,
      };
      this.emitMessage(chatMessage);
    } catch (error) {
      const rawData = typeof event.data === 'string' ? event.data : '';
      const protocolError = new ProtocolError(
        'Failed to parse assistant WebSocket message',
        rawData,
        'JSON.parse',
        { cause: error instanceof Error ? error : undefined },
      );
      console.error('Error parsing assistant websocket message', protocolError);
      // Surface parse failures as a chat message so the user knows something went wrong
      const chatMessage: ChatMessage = {
        id: createMessageId(),
        action: 'agent_error',
        message: 'Received a malformed response from the assistant. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      this.emitMessage(chatMessage);
    }
  }

  private extractActionPayload(payload: AgentResponse): AssistantActionPayload | null {
    if (isActionPayload(payload)) {
      return payload;
    }

    if (isActionPayload(payload.message)) {
      return payload.message;
    }

    if (typeof payload.message !== 'string') {
      return null;
    }

    const message = payload.message.trim();

    // ``trusted`` = the WHOLE reply is the action envelope (the legitimate
    // delivery channel). ``fenced-code-block`` / ``embedded-json-search``
    // scrape an action object out of surrounding prose — that is the
    // prompt-injection surface, so side-effect actions found that way are
    // rejected below.
    const strategies: Array<{ label: string; value: string; trusted: boolean }> = [];

    const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = fenceRegex.exec(message)) !== null) {
      if (match[1]) {
        strategies.push({ label: 'fenced-code-block', value: match[1].trim(), trusted: false });
      }
    }
    if (message.startsWith('{') && message.endsWith('}')) {
      strategies.push({ label: 'raw-json-object', value: message, trusted: true });
    }

    // Also try to find a JSON object anywhere in the message (handles
    // cases where the platform prepends/appends text around the payload).
    if (strategies.length === 0) {
      const jsonMatch = message.match(/\{[\s\S]*"action"\s*:\s*"[^"]+[\s\S]*\}/);
      if (jsonMatch) {
        strategies.push({ label: 'embedded-json-search', value: jsonMatch[0], trusted: false });
      }
    }

    for (const { label, value, trusted } of strategies) {
      try {
        const parsed = JSON.parse(value);
        if (!isActionPayload(parsed)) {
          continue;
        }
        // A side-effect action (model mutation / paid run) mined from prose
        // is not honoured — only benign actions (assistant_message, etc.)
        // may come from a scraped strategy. Blocks prompt-injected commands.
        if (!trusted && isSideEffectAction(parsed)) {
          console.warn(
            `[AssistantClient] Ignoring side-effect action "${(parsed as { action: string }).action}" ` +
              `scraped from prose via "${label}". Side-effect actions must be the whole structured reply.`,
          );
          continue;
        }
        return parsed;
      } catch (parseError) {
        console.debug(`[AssistantClient] extractActionPayload: strategy "${label}" failed to parse`, parseError);
        // Keep searching remaining strategies.
      }
    }

    return null;
  }

  private attemptReconnect(): void {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts || this.reconnectTimeout) {
      return;
    }
    this.reconnectAttempts += 1;
    const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch((error) => console.error('Assistant reconnect failed', error));
    }, delay);
  }

  private startResponseTimer(): void {
    this.clearResponseTimer();
    this.responseTimeout = setTimeout(() => {
      this.emitTyping(false);
      this.emitMessage({
        id: createMessageId(),
        action: 'agent_error',
        message: 'The assistant is taking too long to respond. Please try again.',
        isUser: false,
        timestamp: new Date(),
      });
    }, this.responseTimeoutMs);
  }

  private clearResponseTimer(): void {
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
  }

  /**
   * Application-level keep-alive. Browsers don't expose WebSocket ping frames,
   * so a silent socket gets reaped by proxy idle timeouts (and the server's
   * ping_timeout) within ~20s. When that happens mid-generation the agent's
   * reply slot goes stale and the result is silently dropped -- the user sees
   * "thinking... generating..." then nothing.
   *
   * We send a lightweight `user_set_variable` heartbeat (an action the agent
   * already handles, no LLM trigger) every 15s. It keeps the socket warm AND
   * lets the agent re-claim its reply slot for this live connection, so a
   * result produced 40s+ later still routes back here. Fires once immediately
   * on (re)connect so the slot is claimed without waiting a full interval.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    const beat = (): void => {
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      try {
        this.ws.send(
          JSON.stringify({
            action: 'user_set_variable',
            user_id: this.sessionId,
            message: { __heartbeat: Date.now() },
          }),
        );
      } catch {
        // best-effort -- a failed beat just means the socket is already gone
      }
    };
    beat();
    this.heartbeatTimer = setInterval(beat, this.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Enqueue a message with deduplication.  Assigns a `clientMessageId` if the
   * message doesn't already have one, and skips the push when a message with
   * the same id is already queued (prevents duplicates on reconnect re-queue).
   */
  private enqueueMessage(item: QueuedMessage): void {
    if (!item.clientMessageId) {
      item.clientMessageId = `cmsg_${this._nextClientMessageId++}`;
    }
    // Deduplicate: don't add if the same clientMessageId is already queued.
    if (this.messageQueue.some((m) => m.clientMessageId === item.clientMessageId)) {
      return;
    }
    this.messageQueue.push(item);
  }

  /**
   * Drain the message queue serially.  Only one drain loop runs at a time.
   * Between each send we yield to the event loop and check the abort flag so
   * that disconnect() / unmount can stop the drain immediately.
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0 || this._drainRunning) {
      return;
    }

    // Reset the abort flag -- we're starting a fresh drain cycle.
    this._drainAborted = false;
    this._drainRunning = true;

    const drainNext = (): void => {
      // Check abort flag between every send.
      if (this._drainAborted || this.messageQueue.length === 0) {
        this._drainRunning = false;
        return;
      }

      // Re-check connection state before each send.
      if (!this.isConnected || !this.ws) {
        // Messages stay in the queue for the next reconnect cycle.
        this._drainRunning = false;
        return;
      }

      const item = this.messageQueue.shift()!;

      try {
        if (item.kind === 'voice') {
          this.sendPayload(this.buildVoicePayload(item.audioBase64, item.mimeType, item.diagramType, item.context));
        } else {
          this.sendPayload(this.buildUserPayload(item.message, item.diagramType, item.context, item.attachments));
        }
      } catch {
        // Re-queue on failure (with dedup) so it's retried on next reconnect.
        this.enqueueMessage(item);
        this._drainRunning = false;
        return;
      }

      // Yield to the event loop before sending the next message.  This keeps
      // the UI responsive and gives disconnect() a chance to set _drainAborted.
      setTimeout(drainNext, 0);
    };

    drainNext();
  }
}

/* ------------------------------------------------------------------ */
/*  Shared singleton                                                   */
/* ------------------------------------------------------------------ */

/**
 * One AssistantClient per browser tab, shared by the floating widget AND the
 * workspace drawer. Each surface used to create its own client → two
 * WebSockets carrying the SAME session id, which collided in BAF's reply
 * routing. A single shared client = one socket, one (unique) session id, and
 * both surfaces render the same conversation via the multi-subscriber handlers
 * above. Each mounted surface should call setContextProvider() to keep the
 * workspace context pointed at its live state, and register handlers with the
 * returned unsubscribe (removed on its own unmount).
 */
let _sharedAssistantClient: AssistantClient | null = null;

export function getSharedAssistantClient(
  url?: string,
  options?: AssistantClientOptions,
): AssistantClient {
  if (!_sharedAssistantClient) {
    _sharedAssistantClient = new AssistantClient(url, options);
  }
  return _sharedAssistantClient;
}

export type {
  AssistantWorkspaceContext,
  AssistantActionPayload,
  DiagramSummary,
  InjectionCommand,
  ChatMessage,
  ProjectMetadata,
  SendStatus,
} from './assistant-types';
