export interface UmlAgentRateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxMessageLength: number;
  cooldownPeriodMs: number;
}

interface RequestRecord {
  timestamp: number;
  messageLength: number;
}

interface ClientRateLimitState {
  requestHistory: RequestRecord[];
  lastRequestTime: number;
  lastSeen: number;
}

export interface UmlAgentRateLimitStatus {
  requestsLastMinute: number;
  requestsLastHour: number;
  cooldownRemaining: number;
}

export interface UmlAgentRateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  status: UmlAgentRateLimitStatus;
}

const CLIENT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export class UmlAgentRateLimiterService {
  private clients = new Map<string, ClientRateLimitState>();
  private lastCleanup: number = 0;
  private debug: boolean = false; // Enable debug logging

  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[ServerRateLimiter]', ...args);
    }
  }

  constructor(private readonly config: UmlAgentRateLimitConfig) {
    this.log('🚀 Server RateLimiter initialized:', config);
  }

  check(clientKey: string, messageLength: number, now: number = Date.now()): UmlAgentRateLimitResult {
    this.log('🔍 Checking rate limit for client:', clientKey, 'messageLength:', messageLength);
    
    const state = this.getState(clientKey);
    state.lastSeen = now;

    this.cleanupOldRequests(state, now);
    this.cleanupStaleClients(now);

    const statusBefore = this.buildStatus(state, now);
    this.log('📊 Status before check:', {
      clientKey,
      requestsLastMinute: statusBefore.requestsLastMinute,
      requestsLastHour: statusBefore.requestsLastHour,
      cooldownRemaining: statusBefore.cooldownRemaining,
      totalClients: this.clients.size,
    });

    if (messageLength > this.config.maxMessageLength) {
      this.log('❌ Message too long');
      return {
        allowed: false,
        reason: `Message too long (max ${this.config.maxMessageLength} characters)`,
        status: statusBefore,
      };
    }

    if (statusBefore.cooldownRemaining > 0) {
      this.log('⏳ Cooldown active');
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil(statusBefore.cooldownRemaining / 1000)} seconds between requests`,
        retryAfter: statusBefore.cooldownRemaining,
        status: statusBefore,
      };
    }

    if (statusBefore.requestsLastMinute >= this.config.maxRequestsPerMinute) {
      this.log('🚫 Per-minute limit exceeded');
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.maxRequestsPerMinute} requests per minute`,
        retryAfter: this.computeRetryAfter(state.requestHistory, now, 60 * 1000),
        status: statusBefore,
      };
    }

    if (statusBefore.requestsLastHour >= this.config.maxRequestsPerHour) {
      this.log('🚫 Per-hour limit exceeded');
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.maxRequestsPerHour} requests per hour`,
        retryAfter: this.computeRetryAfter(state.requestHistory, now, 60 * 60 * 1000),
        status: statusBefore,
      };
    }

    state.lastRequestTime = now;
    state.requestHistory.push({ timestamp: now, messageLength });

    const statusAfter = this.buildStatus(state, now);
    this.log('✅ Request allowed. Status after:', {
      requestsLastMinute: statusAfter.requestsLastMinute,
      requestsLastHour: statusAfter.requestsLastHour,
      cooldownRemaining: statusAfter.cooldownRemaining,
    });
    
    return {
      allowed: true,
      status: statusAfter,
    };
  }

  reset(clientKey: string): void {
    this.log('🔄 Resetting rate limit for client:', clientKey);
    this.clients.delete(clientKey);
  }

  private getState(clientKey: string): ClientRateLimitState {
    let state = this.clients.get(clientKey);
    if (!state) {
      state = {
        requestHistory: [],
        lastRequestTime: 0,
        lastSeen: Date.now(),
      };
      this.clients.set(clientKey, state);
    }
    return state;
  }

  private cleanupOldRequests(state: ClientRateLimitState, now: number): void {
    const oneHourAgo = now - (60 * 60 * 1000);
    if (state.requestHistory.length === 0) {
      return;
    }

    state.requestHistory = state.requestHistory.filter(record => record.timestamp > oneHourAgo);
    if (state.requestHistory.length === 0) {
      state.lastRequestTime = 0;
    }
  }

  private cleanupStaleClients(now: number): void {
    const cleanupInterval = 60 * 1000;
    if (now - this.lastCleanup < cleanupInterval) {
      return;
    }

    this.lastCleanup = now;

    for (const [key, state] of this.clients.entries()) {
      if (state.requestHistory.length === 0 && now - state.lastSeen > CLIENT_TTL_MS) {
        this.clients.delete(key);
      }
    }
  }

  private buildStatus(state: ClientRateLimitState, now: number): UmlAgentRateLimitStatus {
    return {
      requestsLastMinute: this.countRequests(state.requestHistory, now, 60 * 1000),
      requestsLastHour: this.countRequests(state.requestHistory, now, 60 * 60 * 1000),
      cooldownRemaining: Math.max(0, this.config.cooldownPeriodMs - (now - state.lastRequestTime)),
    };
  }

  private countRequests(requests: RequestRecord[], now: number, windowMs: number): number {
    const cutoff = now - windowMs;
    return requests.filter(record => record.timestamp > cutoff).length;
  }

  private computeRetryAfter(requests: RequestRecord[], now: number, windowMs: number): number {
    const cutoff = now - windowMs;
    let earliest: number | null = null;

    for (const record of requests) {
      if (record.timestamp > cutoff) {
        if (earliest === null || record.timestamp < earliest) {
          earliest = record.timestamp;
        }
      }
    }

    if (earliest === null) {
      return windowMs;
    }

    return Math.max(0, windowMs - (now - earliest));
  }
}
