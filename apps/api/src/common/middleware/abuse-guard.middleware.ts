import {
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const ABUSE_PATTERNS: RegExp[] = [
  /(\bunion\b[\s\S]{0,40}\bselect\b)/i,
  /(\bselect\b[\s\S]{0,40}\bfrom\b[\s\S]{0,40}\bwhere\b)/i,
  /(\bdrop\b\s+\btable\b)/i,
  /(\binsert\b\s+\binto\b)/i,
  /(\bupdate\b[\s\S]{0,40}\bset\b)/i,
  /(\bdelete\b\s+\bfrom\b)/i,
  /(\bor\b\s+1\s*=\s*1)/i,
  /(\.\.\/|\.\.\\)/,
  /<script\b/i,
  /javascript\s*:/i,
  /\bonerror\s*=/i,
  /\bonload\s*=/i,
  /\beval\s*\(/i,
];

const BLOCK_MS = 15 * 60 * 1000;
const STRIKE_WINDOW_MS = 10 * 60 * 1000;
const MAX_STRIKES = 8;

type StrikeState = { count: number; windowStarted: number; blockedUntil?: number };

@Injectable()
export class AbuseGuardMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AbuseGuardMiddleware.name);
  private readonly strikes = new Map<string, StrikeState>();

  use(req: Request, res: Response, next: NextFunction) {
    const ip = this.resolveIp(req);
    const now = Date.now();
    const state = this.strikes.get(ip);

    if (state?.blockedUntil && state.blockedUntil > now) {
      res.status(403).json({
        statusCode: 403,
        message: 'IP temporalmente bloqueada',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const haystack = this.buildHaystack(req);
    if (this.matchesAbuse(haystack)) {
      this.registerStrike(ip, now);
      this.logger.warn(`Patrón de abuso detectado desde ${ip} ${req.method} ${req.originalUrl}`);
      res.status(403).json({
        statusCode: 403,
        message: 'Petición bloqueada',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  }

  private resolveIp(req: Request): string {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.trim()) return cf.trim();
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length) {
      return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private buildHaystack(req: Request): string {
    let url = req.originalUrl ?? req.url ?? '';
    try {
      url = decodeURIComponent(url);
    } catch {
      // keep raw
    }
    const parts = [url];
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      try {
        parts.push(JSON.stringify(req.body));
      } catch {
        // ignore
      }
    }
    return parts.join('\n');
  }

  private matchesAbuse(value: string): boolean {
    if (!value) return false;
    return ABUSE_PATTERNS.some((pattern) => pattern.test(value));
  }

  private registerStrike(ip: string, now: number) {
    const current = this.strikes.get(ip);
    if (!current || now - current.windowStarted > STRIKE_WINDOW_MS) {
      this.strikes.set(ip, { count: 1, windowStarted: now });
      return;
    }
    current.count += 1;
    if (current.count >= MAX_STRIKES) {
      current.blockedUntil = now + BLOCK_MS;
      this.logger.warn(`IP ${ip} bloqueada por ${BLOCK_MS / 60000} min`);
    }
    this.strikes.set(ip, current);
  }
}
