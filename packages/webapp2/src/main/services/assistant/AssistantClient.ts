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

interface FileAttachmentPayload {
  filename: string;
  content: string; // base64-encoded
  mimeType: string;
}

interface QueuedMessage {
  message: string;
  diagramType: string;
  model?: any;
  context?: Partial<AssistantWorkspaceContext>;
  attachments?: FileAttachmentPayload[];
}

const SESSION_STORAGE_KEY = 'besser-assistant-session-id';

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
  'trigger_export',
  'trigger_deploy',
  'auto_generate_gui',
  'agent_error',
  'progress',
  'stream_start',
  'stream_chunk',
  'stream_done',
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
  fallbackModel?: any,
): AssistantWorkspaceContext => {
  const activeDiagramType = override?.activeDiagramType || base?.activeDiagramType || fallbackDiagramType || 'ClassDiagram';
  return {
    activeDiagramType,
    activeDiagramId: override?.activeDiagramId || base?.activeDiagramId,
    activeModel: override?.activeModel || base?.activeModel || fallbackModel,
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

// --- Context delta optimisation ---

let lastSentModelHash: string | null = null;

const hashModel = (model: any): string => {
  const str = JSON.stringify(model);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash.toString(36);
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

  // Context delta optimisation: if the active model hasn't changed since the
  // last send, replace the full model with a lightweight hash reference.
  if (compacted.activeModel) {
    const modelHash = hashModel(compacted.activeModel);
    const contextUnchanged = modelHash === lastSentModelHash;
    lastSentModelHash = modelHash;

    if (contextUnchanged) {
      compacted.contextUnchanged = true;
      compacted.modelHash = modelHash;
      delete compacted.activeModel;
    }
  }

  // De-duplicate: if activeModel is the same reference that already lives inside
  // the projectSnapshot, don't send it twice.
  if (
    compacted.activeModel &&
    isObject(compacted.projectSnapshot) &&
    isObject(compacted.projectSnapshot.diagrams) &&
    typeof compacted.activeDiagramType === 'string'
  ) {
    const diagramsForType = compacted.projectSnapshot.diagrams[compacted.activeDiagramType];
    // Handle both array (v2) and single object (v1) formats
    const activeDiagramPayload = Array.isArray(diagramsForType)
      ? diagramsForType[compacted.projectSnapshot.currentDiagramIndices?.[compacted.activeDiagramType] ?? 0]
      : diagramsForType;
    const activeSnapshotModel = isObject(activeDiagramPayload) ? activeDiagramPayload.model : undefined;
    if (activeSnapshotModel && compacted.activeModel === activeSnapshotModel) {
      delete compacted.activeModel;
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
  private queueDrainTimers: ReturnType<typeof setTimeout>[] = [];
  private shouldReconnect = true;
  private responseTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly responseTimeoutMs = 45000;

  private readonly clientMode: AssistantClientMode;
  private readonly sessionId: string;
  private readonly contextProvider?: () => AssistantWorkspaceContext | undefined;

  private onMessageHandler: MessageHandler | null = null;
  private onConnectionHandler: ConnectionHandler | null = null;
  private onTypingHandler: TypingHandler | null = null;
  private onInjectionHandler: InjectionHandler | null = null;
  private onActionHandler: ActionHandler | null = null;

  constructor(private readonly url: string = 'ws://localhost:8765', options: AssistantClientOptions = {}) {
    this.clientMode = options.clientMode || 'widget';
    this.sessionId = options.sessionId || createSessionId();
    this.contextProvider = options.contextProvider;
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
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          this.onConnectionHandler?.(true);
          this.processMessageQueue();
          this.connectingPromise = null;
          resolve();
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.connectingPromise = null;
          this.onTypingHandler?.(false);
          this.onConnectionHandler?.(false);
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
          this.onTypingHandler?.(false);
          this.onConnectionHandler?.(false);
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
    this.clearResponseTimer();
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
    this.queueDrainTimers.forEach(clearTimeout);
    this.queueDrainTimers = [];
    this.connectingPromise = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    if (options.clearQueue) {
      this.messageQueue = [];
    }
    this.onTypingHandler?.(false);
    this.onConnectionHandler?.(false);
  }

  sendMessage(
    message: string,
    diagramType?: string,
    model?: any,
    context?: Partial<AssistantWorkspaceContext>,
    attachments?: FileAttachmentPayload[],
  ): SendStatus {
    const type = diagramType || 'ClassDiagram';
    if (!this.isConnected || !this.ws) {
      this.messageQueue.push({ message, diagramType: type, model, context, attachments });
      return 'queued';
    }
    try {
      this.sendPayload(this.buildUserPayload(message, type, model, context, attachments));
      return 'sent';
    } catch (error) {
      console.error('Failed to send assistant message', error);
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

  sendModelContext(model: any, message: string, diagramType?: string): boolean {
    return this.sendMessage(message, diagramType, model) !== 'error';
  }

  onMessage(handler: MessageHandler): void {
    this.onMessageHandler = handler;
  }

  onConnection(handler: ConnectionHandler): void {
    this.onConnectionHandler = handler;
  }

  onTyping(handler: TypingHandler): void {
    this.onTypingHandler = handler;
  }

  onInjection(handler: InjectionHandler): void {
    this.onInjectionHandler = handler;
  }

  onAction(handler: ActionHandler): void {
    this.onActionHandler = handler;
  }

  clearHandlers(): void {
    this.onMessageHandler = null;
    this.onConnectionHandler = null;
    this.onTypingHandler = null;
    this.onInjectionHandler = null;
    this.onActionHandler = null;
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
    model?: any,
    contextOverride?: Partial<AssistantWorkspaceContext>,
    attachments?: FileAttachmentPayload[],
  ): Record<string, any> {
    const baseContext = this.contextProvider?.();
    const context = compactContextPayload(
      mergeContexts(baseContext, contextOverride, diagramType, model),
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
    this.ws.send(JSON.stringify(this.buildWirePayload(payload)));
    this.onTypingHandler?.(true);
    this.startResponseTimer();
  }

  private handleMessage(event: MessageEvent): void {
    this.clearResponseTimer();
    try {
      const payload = JSON.parse(event.data) as AgentResponse;
      this.onTypingHandler?.(false);

      const directAction = this.extractActionPayload(payload);
      if (directAction) {
        if (isInjectionCommand(directAction)) {
          this.onInjectionHandler?.({
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
          this.onActionHandler?.(directAction);
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
          this.onMessageHandler?.(chatMessage);
        }
        return;
      }

      const chatMessage: ChatMessage = {
        id: createMessageId(),
        action: payload.action,
        message: payload.message,
        isUser: false,
        timestamp: new Date(),
        diagramType: payload.diagramType,
      };
      this.onMessageHandler?.(chatMessage);
    } catch (error) {
      console.error('Error parsing assistant websocket message', error);
      // Surface parse failures as a chat message so the user knows something went wrong
      const chatMessage: ChatMessage = {
        id: createMessageId(),
        action: 'agent_error',
        message: 'Received a malformed response from the assistant. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      this.onMessageHandler?.(chatMessage);
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
    const candidates: string[] = [];

    const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = fenceRegex.exec(message)) !== null) {
      if (match[1]) {
        candidates.push(match[1].trim());
      }
    }
    if (message.startsWith('{') && message.endsWith('}')) {
      candidates.push(message);
    }

    // Also try to find a JSON object anywhere in the message (handles
    // cases where the platform prepends/appends text around the payload).
    if (candidates.length === 0) {
      const jsonMatch = message.match(/\{[\s\S]*"action"\s*:\s*"[^"]+[\s\S]*\}/);
      if (jsonMatch) {
        candidates.push(jsonMatch[0]);
      }
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (isActionPayload(parsed)) {
          return parsed;
        }
      } catch {
        // Ignore parse errors and keep searching.
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
      this.onTypingHandler?.(false);
      this.onMessageHandler?.({
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

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    // Clear any lingering drain timers from a previous cycle.
    this.queueDrainTimers.forEach(clearTimeout);
    this.queueDrainTimers = [];

    const queued = [...this.messageQueue];
    this.messageQueue = [];

    queued.forEach((item, index) => {
      const timer = setTimeout(() => {
        // Re-check connection state before each deferred send.
        if (!this.isConnected || !this.ws) {
          // Re-queue the message so it's not silently lost.
          this.messageQueue.push(item);
          return;
        }
        try {
          this.sendPayload(this.buildUserPayload(item.message, item.diagramType, item.model, item.context, item.attachments));
        } catch {
          // Re-queue on failure so it's retried on next reconnect.
          this.messageQueue.push(item);
        }
      }, index * 1000);
      this.queueDrainTimers.push(timer);
    });
  }
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
