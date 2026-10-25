import type { Request } from 'express';
import { isIpToken, resolveClientIp } from './client-ip';

function request(headers: Record<string, string>, ip = '198.51.100.20'): Request {
  return {
    ip,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

describe('resolveClientIp', () => {
  const previous = process.env.CLIENT_IP_SECRET;

  afterEach(() => {
    if (previous === undefined) delete process.env.CLIENT_IP_SECRET;
    else process.env.CLIENT_IP_SECRET = previous;
  });

  it('sin secreto ignora CF-Connecting-IP y el primer X-Forwarded-For', () => {
    delete process.env.CLIENT_IP_SECRET;
    const ip = resolveClientIp(request({
      'x-forwarded-for': '203.0.113.9, 198.51.100.20',
      'cf-connecting-ip': '203.0.113.50',
      'x-luxtimee-client-ip': '203.0.113.77',
      'x-luxtimee-proxy-secret': 'edge-secret',
    }));
    expect(ip).toBe('198.51.100.20');
  });

  it('con secreto usa solo la IP firmada', () => {
    const ip = resolveClientIp(request({
      'x-forwarded-for': '203.0.113.9',
      'cf-connecting-ip': '198.51.100.8',
      'x-luxtimee-client-ip': '203.0.113.50',
      'x-luxtimee-proxy-secret': 'edge-secret',
    }, '10.0.0.8'), 'edge-secret');
    expect(ip).toBe('203.0.113.50');
  });

  it('un secreto distinto no cambia req.ip', () => {
    const ip = resolveClientIp(request({
      'x-luxtimee-client-ip': '203.0.113.50',
      'x-luxtimee-proxy-secret': 'otro',
    }, '10.0.0.8'), 'edge-secret');
    expect(ip).toBe('10.0.0.8');
  });

  it('rechaza una IP firmada que no es una IP', () => {
    const ip = resolveClientIp(request({
      'x-luxtimee-client-ip': 'no-es-ip',
      'x-luxtimee-proxy-secret': 'edge-secret',
    }, '10.0.0.8'), 'edge-secret');
    expect(ip).toBe('10.0.0.8');
    expect(isIpToken('203.0.113.50')).toBe(true);
    expect(isIpToken('2001:db8::1')).toBe(true);
    expect(isIpToken('luxtimee.com')).toBe(false);
  });
});
