import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

export const CLIENT_IP_HEADER = 'x-luxtimee-client-ip';
export const CLIENT_IP_SECRET_HEADER = 'x-luxtimee-proxy-secret';

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

export function isIpToken(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (IPV4.test(trimmed)) return true;
  if (trimmed.length > 64 || !trimmed.includes(':')) return false;
  const core = trimmed.split('%')[0].toLowerCase();
  if (!core.includes(':') || !/^[0-9a-f:]+$/.test(core)) return false;
  const halves = core.split('::');
  return halves.length <= 2;
}

function headerValue(req: Request, name: string) {
  const raw = req.headers?.[name];
  if (Array.isArray(raw)) return raw[0]?.trim() || '';
  return typeof raw === 'string' ? raw.trim() : '';
}

function secretsMatch(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const left = createHash('sha256').update(provided).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

/**
 * `trust proxy` sigue en 1: el primer X-Forwarded-For no es el cliente.
 * La IP real solo entra si el proxy de Vercel la firma con CLIENT_IP_SECRET.
 * Sin secreto, se usa req.ip (en Cloud Run, el peer que añadió el balanceador).
 */
export function resolveClientIp(req: Request, secret = process.env.CLIENT_IP_SECRET?.trim() || '') {
  const signed = headerValue(req, CLIENT_IP_HEADER);
  const provided = headerValue(req, CLIENT_IP_SECRET_HEADER);
  if (secret && isIpToken(signed) && secretsMatch(provided, secret)) return signed;
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
