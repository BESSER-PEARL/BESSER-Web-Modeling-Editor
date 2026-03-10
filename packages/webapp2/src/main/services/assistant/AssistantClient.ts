import type {
  ActionHandler,
  AgentResponse,
  AssistantActionPayload,
  AssistantClientMode,
  AssistantClientOptions,
  AssistantWorkspaceContext,
  ChatMessage,
  ConnectionHandler,
  InjectionCommand,
  InjectionHandler,
  MessageHandler,
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

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
  'trigger_generator',
  'trigger_export',
  'trigger_deploy',
  'auto_generate_gui',
  'agent_error',
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
    diagramSummaries: override?.diagramSummaries || base?.diagramSummaries || [],
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

const compactContextPayload = (context: AssistantWorkspaceContext): AssistantWorkspaceContext => {
  const compacted: AssistantWorkspaceContext = { ...context };
  const compactProjectSnapshot = stripRedundantProjectMetadata(context.projectSnapshot);
  if (compactProjectSnapshot) {
    compacted.projectSnapshot = compactProjectSnapshot;
  }

  // Safe reduction: backend can derive summaries from projectSnapshot when needed.
  if (Array.isArray(compacted.diagramSummaries)) {
    delete compacted.diagramSummaries;
  }

  if (
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
  InjectionCommand,
  ChatMessage,
  SendStatus,
} from './assistant-types';
