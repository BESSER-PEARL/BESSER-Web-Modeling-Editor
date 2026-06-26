/**
 * Rate Limiter Service
 * Prevents API spam and abuse of the AI assistant
 *
 * Supports adaptive rate limits based on message type:
 *   - simple:     high-frequency chat (greetings, help, short text)
 *   - model:      diagram / metamodel operations
 *   - generation: code generation, deploy, export
 */

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxMessageLength: number;
  cooldownPeriodMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // milliseconds until next request allowed
}

export interface RateLimitStatus {
  requestsLastMinute: number;
  requestsLastHour: number;
  cooldownRemaining: number;
}

interface RequestRecord {
  timestamp: number;
  messageLength: number;
}

interface RateLimiterPersistedState {
  requestHistory: RequestRecord[];
  lastRequestTime: number;
}

// ---------------------------------------------------------------------------
// Adaptive rate-limit tiers
// ---------------------------------------------------------------------------

type MessageType = 'simple' | 'model' | 'generation';

interface TierLimits {
  perMinute: number;
  perHour: number;
}

const RATE_LIMITS: Record<MessageType | 'default', TierLimits> = {
  // Simple messages (short text, greetings, help)
  simple: { perMinute: 15, perHour: 100 },
  // Model operations (create, modify diagrams)
  model: { perMinute: 10, perHour: 60 },
  // Generation triggers (generate code)
  generation: { perMinute: 5, perHour: 30 },
  // Default fallback
  default: { perMinute: 12, perHour: 80 },
};

/**
 * Classify a user message into a rate-limit tier so that heavier operations
 * are throttled more aggressively while quick chat stays responsive.
 */
function classifyMessage(message: string): MessageType {
  const lower = message.toLowerCase().trim();

  // Generation patterns
  if (/^generate\s|^deploy\s|^export\s/.test(lower)) return 'generation';
  if (/generate\s+(django|python|java|sql|react|code|web\s*app)/i.test(lower)) return 'generation';

  // Model operations
  if (/^(create|build|design|add|modify|remove|delete|split|merge|extract)/i.test(lower)) return 'model';
  if (/class|diagram|attribute|method|relationship|state\s*machine|agent/i.test(lower)) return 'model';

  // Everything else is simple
  return 'simple';
}

/**
 * Return a human-friendly message when a rate limit is hit.
 */
function getRateLimitMessage(
  window: 'minute' | 'hour',
  limits: TierLimits,
): string {
  if (window === 'minute') {
    return `Slow down a bit! Max ${limits.perMinute} messages per minute. Try again in a few seconds.`;
  }
  return `You've been busy! Max ${limits.perHour} messages per hour. Take a short break.`;
}

// ---------------------------------------------------------------------------

const RATE_LIMIT_STORAGE_KEY = 'umlAgentRateLimiterState';
const RATE_LIMIT_ENDPOINT_DEFAULT = '/api/uml-agent/rate-limit/check';

export type RateLimiterOptions = Partial<RateLimitConfig> & {
  useServerSideLimit?: boolean;
  endpoint?: string;
  persistLocally?: boolean;
};

interface ServerRateLimitResponse extends RateLimitResult {
  status?: RateLimitStatus;
}

export class RateLimiterService {
  private requestHistory: RequestRecord[] = [];
  private lastRequestTime: number = 0;
  private config: RateLimitConfig;
  private storage: Storage | null;
  private persistLocally: boolean;
  private useServerSide: boolean;
  private endpoint: string;
  private lastRemoteStatus: RateLimitStatus | null = null;
  private lastRemoteStatusTimestamp: number = 0;
  private debug: boolean = false;

  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[RateLimiter]', ...args);
    }
  }

  constructor(options?: RateLimiterOptions) {
    this.config = {
      maxRequestsPerMinute: options?.maxRequestsPerMinute ?? 12,
      maxRequestsPerHour: options?.maxRequestsPerHour ?? 80,
      maxMessageLength: options?.maxMessageLength ?? 1000,
      cooldownPeriodMs: options?.cooldownPeriodMs ?? 1500,
    };

    this.useServerSide = options?.useServerSideLimit ?? true;
    this.endpoint = options?.endpoint ?? RATE_LIMIT_ENDPOINT_DEFAULT;
    this.persistLocally = options?.persistLocally ?? true;
    this.storage = RateLimiterService.resolveStorage();

    this.log('RateLimiter initialized:', {
      persistLocally: this.persistLocally,
      useServerSide: this.useServerSide,
      endpoint: this.endpoint,
      storageAvailable: !!this.storage,
      config: this.config,
    });

    if (this.persistLocally) {
      this.loadState();
      this.log('State loaded:', {
        requestHistoryCount: this.requestHistory.length,
        lastRequestTime: this.lastRequestTime,
        oldestRequest: this.requestHistory[0]?.timestamp,
        newestRequest: this.requestHistory[this.requestHistory.length - 1]?.timestamp,
      });
    }
  }

  /**
   * Check if a request is allowed based on rate limits.
   *
   * Accepts either the full message text (string) for adaptive rate limiting,
   * or a numeric message length for backward compatibility (uses default tier).
   */
  async checkRateLimit(messageOrLength: string | number): Promise<RateLimitResult> {
    const isString = typeof messageOrLength === 'string';
    const messageLength = isString ? messageOrLength.length : messageOrLength;
    const messageType: MessageType = isString ? classifyMessage(messageOrLength) : 'default' as any;
    const limits: TierLimits = RATE_LIMITS[messageType] || RATE_LIMITS.default;

    this.log('Checking rate limit:', { messageLength, messageType, limits, useServerSide: this.useServerSide });

    if (messageLength > this.config.maxMessageLength) {
      this.log('Message too long');
      return {
        allowed: false,
        reason: `Message too long (max ${this.config.maxMessageLength} characters)`,
      };
    }

    if (this.useServerSide && typeof fetch === 'function') {
      this.log('Checking server-side rate limit...');
      const serverResult = await this.tryServerRateLimit(messageLength);
      if (serverResult) {
        this.log('Server response:', serverResult);
        if (serverResult.status) {
          this.updateRemoteStatus(serverResult.status, serverResult.allowed, messageLength);
        }
        return {
          allowed: serverResult.allowed,
          reason: serverResult.reason,
          retryAfter: serverResult.retryAfter,
        };
      }
      this.log('Server check failed, falling back to local');
    }

    const localResult = this.checkLocalRateLimit(messageLength, limits);
    this.log('Local rate limit result:', localResult);
    return localResult;
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitStatus {
    const now = Date.now();

    if (this.lastRemoteStatus && (now - this.lastRemoteStatusTimestamp) < 5000) {
      const elapsed = now - this.lastRemoteStatusTimestamp;
      const status = {
        requestsLastMinute: this.lastRemoteStatus.requestsLastMinute,
        requestsLastHour: this.lastRemoteStatus.requestsLastHour,
        cooldownRemaining: Math.max(0, this.lastRemoteStatus.cooldownRemaining - elapsed),
      };
      this.log('Status (server):', status);
      return status;
    }

    const localStatus = this.getLocalStatus(now);
    this.log('Status (local):', localStatus);
    return localStatus;
  }

  /**
   * Reset rate limiter (for testing or manual override)
   */
  reset(): void {
    this.requestHistory = [];
    this.lastRequestTime = 0;
    this.lastRemoteStatus = null;
    this.lastRemoteStatusTimestamp = 0;

    if (this.persistLocally) {
      this.persistState();
    }

    if (this.useServerSide && typeof fetch === 'function') {
      this.sendServerReset().catch(() => undefined);
    }
  }

  /**
   * Get time until next request is allowed
   */
  getTimeUntilNextRequest(): number {
    const now = Date.now();
    if (this.lastRemoteStatus) {
      const elapsed = now - this.lastRemoteStatusTimestamp;
      return Math.max(0, this.lastRemoteStatus.cooldownRemaining - elapsed);
    }

    return Math.max(0, this.config.cooldownPeriodMs - (now - this.lastRequestTime));
  }

  /**
   * Check if user can send a message right now
   */
  canSendNow(): boolean {
    return this.getTimeUntilNextRequest() <= 0;
  }

  private async tryServerRateLimit(messageLength: number): Promise<ServerRateLimitResponse | null> {
    try {
      this.log('Sending server request to:', this.endpoint);
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ messageLength }),
      });

      this.log('Server response status:', response.status);

      const data = await response.json().catch(() => null);
      if (!data || typeof data.allowed !== 'boolean') {
        this.log('Invalid server response:', data);
        return null;
      }

      const statusPayload = data.status;
      const status: RateLimitStatus | undefined =
        statusPayload && typeof statusPayload === 'object'
          ? {
              requestsLastMinute: Number(statusPayload.requestsLastMinute) || 0,
              requestsLastHour: Number(statusPayload.requestsLastHour) || 0,
              cooldownRemaining: Number(statusPayload.cooldownRemaining) || 0,
            }
          : undefined;

      return {
        allowed: data.allowed,
        reason: typeof data.reason === 'string' ? data.reason : undefined,
        retryAfter: typeof data.retryAfter === 'number' ? data.retryAfter : undefined,
        status,
      };
    } catch (error) {
      this.log('Server request failed:', error);
      return null;
    }
  }

  private async sendServerReset(): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
    } catch {
      // Ignore reset errors - mainly used for tests/manual overrides.
    }
  }

  private updateRemoteStatus(status: RateLimitStatus, wasAllowed: boolean, messageLength: number): void {
    const now = Date.now();
    this.lastRemoteStatus = status;
    this.lastRemoteStatusTimestamp = now;

    const normalizedCooldown = Math.min(Math.max(status.cooldownRemaining, 0), this.config.cooldownPeriodMs);
    const timeSinceLastRequest = this.config.cooldownPeriodMs - normalizedCooldown;
    this.lastRequestTime = timeSinceLastRequest > 0 ? now - timeSinceLastRequest : now - this.config.cooldownPeriodMs;

    if (wasAllowed) {
      this.trackLocalRequest(now, messageLength);
    }
  }

  private checkLocalRateLimit(messageLength: number, limits: TierLimits): RateLimitResult {
    const now = Date.now();

    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.cooldownPeriodMs) {
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil((this.config.cooldownPeriodMs - timeSinceLastRequest) / 1000)} seconds between requests`,
        retryAfter: this.config.cooldownPeriodMs - timeSinceLastRequest,
      };
    }

    this.cleanupOldRecords(now);

    const requestsLastMinute = this.countRequestsInWindow(now, 60 * 1000);
    if (requestsLastMinute >= limits.perMinute) {
      return {
        allowed: false,
        reason: getRateLimitMessage('minute', limits),
        retryAfter: 60 * 1000,
      };
    }

    const requestsLastHour = this.countRequestsInWindow(now, 60 * 60 * 1000);
    if (requestsLastHour >= limits.perHour) {
      return {
        allowed: false,
        reason: getRateLimitMessage('hour', limits),
        retryAfter: 60 * 60 * 1000,
      };
    }

    this.trackLocalRequest(now, messageLength);

    return { allowed: true };
  }

  private getLocalStatus(now: number): RateLimitStatus {
    this.cleanupOldRecords(now);

    return {
      requestsLastMinute: this.countRequestsInWindow(now, 60 * 1000),
      requestsLastHour: this.countRequestsInWindow(now, 60 * 60 * 1000),
      cooldownRemaining: Math.max(0, this.config.cooldownPeriodMs - (now - this.lastRequestTime)),
    };
  }

  private trackLocalRequest(timestamp: number, messageLength: number): void {
    this.lastRequestTime = timestamp;
    this.requestHistory.push({
      timestamp,
      messageLength,
    });

    if (this.persistLocally) {
      this.persistState();
    }
  }

  private countRequestsInWindow(now: number, windowMs: number): number {
    const cutoff = now - windowMs;
    return this.requestHistory.filter(record => record.timestamp > cutoff).length;
  }

  private cleanupOldRecords(now: number, persistAfterCleanup: boolean = true): void {
    const oneHourAgo = now - (60 * 60 * 1000);
    const originalLength = this.requestHistory.length;
    this.requestHistory = this.requestHistory.filter(
      record => record.timestamp > oneHourAgo
    );

    if (this.persistLocally && persistAfterCleanup && originalLength !== this.requestHistory.length) {
      this.persistState();
    }
  }

  private static resolveStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const storage = window.localStorage;
      const testKey = '__umlAgentRateLimiter__';
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return storage;
    } catch {
      return null;
    }
  }

  private loadState(): void {
    if (!this.storage) {
      this.log('No storage available for loading state');
      return;
    }

    try {
      const storedValue = this.storage.getItem(RATE_LIMIT_STORAGE_KEY);
      this.log('Reading from storage:', RATE_LIMIT_STORAGE_KEY);

      if (!storedValue) {
        this.log('No stored state found');
        return;
      }

      this.log('Raw stored value:', storedValue);
      const parsed: RateLimiterPersistedState = JSON.parse(storedValue);

      if (!Array.isArray(parsed?.requestHistory) || typeof parsed?.lastRequestTime !== 'number') {
        this.log('Invalid stored state format:', parsed);
        return;
      }

      this.requestHistory = parsed.requestHistory.filter(
        (record): record is RequestRecord =>
          typeof record?.timestamp === 'number' && typeof record?.messageLength === 'number'
      );
      this.lastRequestTime = parsed.lastRequestTime;

      this.log('State loaded successfully:', {
        requestCount: this.requestHistory.length,
        lastRequestTime: new Date(this.lastRequestTime).toISOString(),
      });

      this.cleanupOldRecords(Date.now(), false);
      this.persistState();
    } catch (error) {
      this.log('Error loading state:', error);
      try {
        this.storage.removeItem(RATE_LIMIT_STORAGE_KEY);
      } catch {
        // ignore storage cleanup errors
      }
    }
  }

  private persistState(): void {
    if (!this.storage) {
      this.log('No storage available for persisting state');
      return;
    }

    const state: RateLimiterPersistedState = {
      requestHistory: this.requestHistory,
      lastRequestTime: this.lastRequestTime,
    };

    try {
      const serialized = JSON.stringify(state);
      this.storage.setItem(RATE_LIMIT_STORAGE_KEY, serialized);
      this.log('State persisted:', {
        key: RATE_LIMIT_STORAGE_KEY,
        requestCount: this.requestHistory.length,
        lastRequestTime: new Date(this.lastRequestTime).toISOString(),
      });
    } catch (error) {
      this.log('Error persisting state:', error);
      this.storage = null;
    }
  }
}
