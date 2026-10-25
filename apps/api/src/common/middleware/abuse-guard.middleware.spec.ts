import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { AbuseGuardMiddleware } from './abuse-guard.middleware';

function invoke(
  mw: AbuseGuardMiddleware,
  ip: string,
  url: string,
  headers: Record<string, string> = {},
) {
  const req = {
    ip,
    headers: {
      'x-forwarded-for': '203.0.113.9',
      'cf-connecting-ip': '198.51.100.1',
      ...headers,
    },
    method: 'GET',
    originalUrl: url,
    url,
    socket: { remoteAddress: '10.0.0.1' },
  } as unknown as Request;

  let status = 0;
  let body: { message?: string } | undefined;
  let continued = false;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: { message?: string }) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  const next: NextFunction = () => {
    continued = true;
  };
  mw.use(req, res, next);
  return { status, body, continued };
}

describe('AbuseGuardMiddleware', () => {
  it('agrupa los bloqueos por req.ip y no por el primer X-Forwarded-For', () => {
    const mw = new AbuseGuardMiddleware();
    for (let i = 0; i < 8; i += 1) {
      const hit = invoke(mw, '10.1.1.1', '/api?q=<script>');
      expect(hit.status).toBe(403);
      expect(hit.body?.message).toBe('Petición bloqueada');
    }

    const blocked = invoke(mw, '10.1.1.1', '/api/v1/health');
    expect(blocked.continued).toBe(false);
    expect(blocked.body?.message).toBe('IP temporalmente bloqueada');

    const otherClient = invoke(mw, '10.2.2.2', '/api/v1/health');
    expect(otherClient.continued).toBe(true);
  });

  it('con secreto agrupa por la IP firmada y no por CF-Connecting-IP', () => {
    const previous = process.env.CLIENT_IP_SECRET;
    process.env.CLIENT_IP_SECRET = 'edge-secret';
    try {
      const mw = new AbuseGuardMiddleware();
      const signed = {
        'x-luxtimee-client-ip': '203.0.113.44',
        'x-luxtimee-proxy-secret': 'edge-secret',
      };
      for (let i = 0; i < 8; i += 1) {
        const hit = invoke(mw, '10.9.9.9', '/api?q=<script>', signed);
        expect(hit.status).toBe(403);
      }
      const blocked = invoke(mw, '10.8.8.8', '/api/v1/health', signed);
      expect(blocked.continued).toBe(false);
      expect(blocked.body?.message).toBe('IP temporalmente bloqueada');

      const otherSigned = invoke(mw, '10.8.8.8', '/api/v1/health', {
        'x-luxtimee-client-ip': '203.0.113.45',
        'x-luxtimee-proxy-secret': 'edge-secret',
      });
      expect(otherSigned.continued).toBe(true);

      const wrongSecret = invoke(mw, '10.7.7.7', '/api/v1/health', {
        'x-luxtimee-client-ip': '203.0.113.44',
        'x-luxtimee-proxy-secret': 'otro',
      });
      expect(wrongSecret.continued).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.CLIENT_IP_SECRET;
      else process.env.CLIENT_IP_SECRET = previous;
    }
  });
});

describe('trust proxy', () => {
  it('toma el cliente que añadió el proxy y no el primer X-Forwarded-For', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.get('/ip', (req, res) => {
      res.json({ ip: req.ip });
    });

    const res = await request(app)
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.9, 198.51.100.20');

    expect(res.status).toBe(200);
    const ip = String(res.body.ip);
    expect(ip).not.toBe('203.0.113.9');
    expect(ip.endsWith('198.51.100.20')).toBe(true);
  });
});
