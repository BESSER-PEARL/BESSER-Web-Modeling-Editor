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

  constructor(private readonly config: UmlAgentRateLimitConfig) {}

  check(clientKey: string, messageLength: number, now: number = Date.now()): UmlAgentRateLimitResult {
    const state = this.getState(clientKey);
    state.lastSeen = now;

    this.cleanupOldRequests(state, now);
    this.cleanupStaleClients(now);

    const statusBefore = this.buildStatus(state, now);

    if (messageLength > this.config.maxMessageLength) {
      return {
        allowed: false,
        reason: `Message too long (max ${this.config.maxMessageLength} characters)`,
        status: statusBefore,
      };
    }

    if (statusBefore.cooldownRemaining > 0) {
      return {
        allowed: false,
        reason: `Please wait ${Math.ceil(statusBefore.cooldownRemaining / 1000)} seconds between requests`,
        retryAfter: statusBefore.cooldownRemaining,
        status: statusBefore,
      };
    }

    if (statusBefore.requestsLastMinute >= this.config.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.maxRequestsPerMinute} requests per minute`,
        retryAfter: this.computeRetryAfter(state.requestHistory, now, 60 * 1000),
        status: statusBefore,
      };
    }

    if (statusBefore.requestsLastHour >= this.config.maxRequestsPerHour) {
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
    return {
      allowed: true,
      status: statusAfter,
    };
  }

  reset(clientKey: string): void {
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
