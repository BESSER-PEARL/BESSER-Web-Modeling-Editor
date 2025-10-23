/**
 * WebSocket service for UML Agent communication
 * Handles all WebSocket messaging, connection management, and response parsing
 */

export interface ChatMessage {
  id: string;
  action: string;
  message: string | object;
  isUser: boolean;
  timestamp: Date;
  diagramType?: string; // Track which diagram type this message relates to
}

export interface AgentResponse {
  action: string;
  message: string | object;
  diagramType?: string;
}

export interface InjectionCommand {
  action: 'inject_element' | 'inject_complete_system' | 'modify_model';
  element?: any;
  systemSpec?: any;
  modification?: any;
  model?: any;
  message: string;
  diagramType?: string; // Diagram type for context
}

export type MessageHandler = (message: ChatMessage) => void;
export type ConnectionHandler = (connected: boolean) => void;
export type TypingHandler = (typing: boolean) => void;
export type InjectionHandler = (command: InjectionCommand) => void;

/**
 * WebSocket service for managing agent communication
 */
export type SendStatus = 'sent' | 'queued' | 'error';

interface QueuedMessage {
  preparedMessage: string;
  diagramType: string;
  model?: any;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private connectingPromise: Promise<void> | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 3000;
  private messageQueue: QueuedMessage[] = [];
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect: boolean = true;

  // Event handlers
  private onMessageHandler: MessageHandler | null = null;
  private onConnectionHandler: ConnectionHandler | null = null;
  private onTypingHandler: TypingHandler | null = null;
  private onInjectionHandler: InjectionHandler | null = null;

  constructor(private url: string = 'ws://localhost:8765') {}

  /**
   * Connect to WebSocket server
   */
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

          // Send queued messages
          this.processMessageQueue();

          this.connectingPromise = null;
          resolve();
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.connectingPromise = null;
          this.onConnectionHandler?.(false);

          if (this.shouldReconnect) {
            this.attemptReconnect();
          } else {
            this.reconnectAttempts = 0;
          }
        };

        this.ws.onerror = (error) => {
          console.error('🔥 WebSocket error:', error);
          this.isConnected = false;
          this.connectingPromise = null;
          this.onConnectionHandler?.(false);

          if (this.shouldReconnect) {
            this.attemptReconnect();
          }

          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        this.connectingPromise = null;
        reject(error);
      }
    });

    return this.connectingPromise;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(options: { allowReconnect?: boolean; clearQueue?: boolean } = {}): void {
    this.shouldReconnect = options.allowReconnect ?? false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.warn('Error closing WebSocket connection', error);
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
    this.onConnectionHandler?.(false);
  }

  /**
   * Send message to agent with diagram type
   * CRITICAL: Sends text message FIRST for intent detection, then JSON payload after delay
   */
  sendMessage(message: string, diagramType?: string, model?: any): SendStatus {
    const type = diagramType || 'ClassDiagram';
    const messageWithPrefix = `[DIAGRAM_TYPE:${type}] ${message}`;

    if (!this.isConnected || !this.ws) {
      console.warn('[ws] WebSocket not connected, queuing message');
      this.messageQueue.push({
        preparedMessage: messageWithPrefix,
        diagramType: type,
        model
      });
      return 'queued';
    }

    try {
      // Step 1: Send text message FIRST for intent detection
      // console.log('[ws] Step 1: Sending text message for intent detection');
      this.sendTextMessage(messageWithPrefix, type);

      // Step 2: Send JSON payload with model context AFTER a small delay
      // This ensures the agent processes intent BEFORE receiving the full context
      if (model) {
        setTimeout(() => {
          // console.log('[ws] Step 2: Sending JSON payload with model context');
          this.sendModelContext(model, messageWithPrefix, type);
        }, 500); // 500ms delay to ensure intent is detected first
      }

      return 'sent';
    } catch (error) {
      console.error('Failed to send message:', error);
      return 'error';
    }
  }
  /**
   * Send model context to agent with diagram type (new feature)
   */
  sendModelContext(model: any, message: string, diagramType?: string): boolean {
    const type = diagramType || 'ClassDiagram';

    if (!this.isConnected || !this.ws) {
      // console.warn('[ws] WebSocket not connected, queuing context payload');
      this.messageQueue.push({
        preparedMessage: message,
        diagramType: type,
        model
      });
      return false;
    }

    try {
      const sanitizedModel = JSON.parse(JSON.stringify(model));
      const envelope = {
        message,
        diagramType: type,
        currentModel: sanitizedModel
      };

      const payload = {
        action: 'user_message',
        message: JSON.stringify(envelope),
        diagramType: type
      };

      this.ws.send(JSON.stringify(payload));
      this.onTypingHandler?.(true);
      return true;
    } catch (error) {
      console.error('[ws] Failed to send model context:', error);
      return false;
    }
  }

  private sendTextMessage(message: string, diagramType: string): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket is not connected');
    }

    const payload = {
      action: 'user_message',
      message,
      diagramType
    };

    // console.log('[ws] Sending message with diagram type:', diagramType);
    this.ws.send(JSON.stringify(payload));
    this.onTypingHandler?.(true);
  }



  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const payload = JSON.parse(event.data) as AgentResponse;
      
      // Hide typing indicator
      this.onTypingHandler?.(false);
      
      // console.log('📨 Received message:', payload);

      // Check if this is an injection command
      const injectionCommand = this.extractInjectionCommand(payload);

      if (injectionCommand) {
        this.onInjectionHandler?.(injectionCommand);
        return;
      }

      // Handle as normal chat message
      const chatMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        action: payload.action,
        message: payload.message,
        isUser: false,
        timestamp: new Date()
      };

      this.onMessageHandler?.(chatMessage);

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Check if response is an injection command
   */
  private isInjectionCommand(data: any): data is InjectionCommand {
    return data &&
           typeof data.action === 'string' &&
           ['inject_element', 'inject_complete_system', 'modify_model'].includes(data.action);
  }

  private extractInjectionCommand(payload: AgentResponse): InjectionCommand | null {
    const { action, message, diagramType } = payload;

    // Direct object payload
    if (this.isInjectionCommand(message)) {
      return {
        ...message,
        diagramType: message.diagramType || diagramType
      };
    }

    if (typeof message !== 'string') {
      return null;
    }

    const trimmed = message.trim();
    const candidates = this.extractJsonCandidates(trimmed);

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (this.isInjectionCommand(parsed)) {
          return {
            ...parsed,
            diagramType: parsed.diagramType || diagramType,
            message: typeof parsed.message === 'string' ? parsed.message : message
          };
        }
      } catch (error) {
        // Ignore parse errors - continue to next candidate
      }
    }

    // Some backends may signal injection with a dedicated action
    if (action === 'agent_reply_json') {
      try {
        const parsed = typeof message === 'string' ? JSON.parse(message) : message;
        if (this.isInjectionCommand(parsed)) {
          return {
            ...parsed,
            diagramType: parsed.diagramType || diagramType
          };
        }
      } catch (error) {
        console.error('Failed to parse agent_reply_json payload', error);
      }
    }

    return null;
  }

  private extractJsonCandidates(content: string): string[] {
    const candidates: string[] = [];

    // Look for fenced code blocks first
    const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = fenceRegex.exec(content)) !== null) {
      if (match[1]) {
        candidates.push(match[1].trim());
      }
    }

    // Fall back to detecting raw JSON objects
    if (content.startsWith('{') && content.endsWith('}')) {
      candidates.push(content);
    }

    return candidates;
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🚫 Max reconnection attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, this.reconnectDelay);
  }

  /**
   * Process queued messages
   * Sends text message first, then model context with delay
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    // console.log(`[ws] Processing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach((item, index) => {
      try {
        // Send text message first
        setTimeout(() => {
          this.sendTextMessage(item.preparedMessage, item.diagramType);

          // Send model context after delay
          if (item.model) {
            setTimeout(() => {
              this.sendModelContext(item.model, item.preparedMessage, item.diagramType);
            }, 500);
          }
        }, index * 1000); // Stagger multiple queued messages
      } catch (error) {
        // console.error('[ws] Failed to process queued message:', error);
      }
    });
  }

  // Event handler setters
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

  clearHandlers(): void {
    this.onMessageHandler = null;
    this.onConnectionHandler = null;
    this.onTypingHandler = null;
    this.onInjectionHandler = null;
  }

  // Getters
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
}
