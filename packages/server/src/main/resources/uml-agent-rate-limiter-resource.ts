import { Request, Response } from 'express';
import {
  UmlAgentRateLimitResult,
  UmlAgentRateLimiterService,
} from '../services/uml-agent/uml-agent-rate-limiter-service';

const DEFAULT_RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 8,
  maxRequestsPerHour: 40,
  // The AUTHORITATIVE message-length cap: the client checks first but then takes
  // this endpoint's verdict, so a lower value here silently overrides it. 1000
  // rejected legitimate messages — a pasted traceback alone clears it, as does
  // any real specification.
  //
  // Keep in sync with `maxMessageLength` in the webapp's RateLimiterService
  // and `MAX_CHAT_PASTE_CHARS` in its paste routing — the webapp test
  // `rate-limit-cap-parity.test.ts` reads this file and asserts they agree.
  maxMessageLength: 32000,
  cooldownPeriodMs: 3000,
};

export class UmlAgentRateLimiterResource {
  private readonly rateLimiter = new UmlAgentRateLimiterService(DEFAULT_RATE_LIMIT_CONFIG);
  private debug: boolean = false;

  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[RateLimiterResource]', ...args);
    }
  }

  checkRateLimit(req: Request, res: Response): void {
    const clientKey = this.getClientKey(req);
    this.log('📥 Rate limit check request from:', clientKey);
    
    const lengthValue = (req.body?.messageLength ?? req.query?.messageLength) as unknown;
    const messageLength = Number(lengthValue);

    if (!Number.isFinite(messageLength) || messageLength < 0) {
      this.log('❌ Invalid message length:', lengthValue);
      res.status(400).json(this.buildErrorResponse('Invalid message length'));
      return;
    }

    const result = this.rateLimiter.check(clientKey, messageLength);
    this.log('📤 Sending response:', {
      allowed: result.allowed,
      status: result.status,
      httpStatus: result.allowed ? 200 : 429,
    });
    res.status(result.allowed ? 200 : 429).json(result);
  }

  resetRateLimit(req: Request, res: Response): void {
    const clientKey = this.getClientKey(req);
    this.log('🔄 Rate limit reset request from:', clientKey);
    this.rateLimiter.reset(clientKey);
    res.status(204).send();
  }

  private buildErrorResponse(reason: string): UmlAgentRateLimitResult {
    return {
      allowed: false,
      reason,
      status: {
        requestsLastMinute: 0,
        requestsLastHour: 0,
        cooldownRemaining: 0,
      },
    };
  }

  private getClientKey(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      return this.normalizeIp(forwarded);
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return this.normalizeIp(forwarded[0]);
    }

    return this.normalizeIp(req.ip || req.socket?.remoteAddress || undefined);
  }

  private normalizeIp(ip: string | undefined | null): string {
    if (!ip) {
      return 'unknown';
    }

    const first = ip.split(',')[0];
    return first.replace('::ffff:', '').trim() || 'unknown';
  }
}
