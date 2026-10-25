import { CLIENT_IP_HEADER, CLIENT_IP_SECRET_HEADER, resolveProxyClientIp } from './client-ip';

const REQUEST_SKIP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'accept-encoding',
  CLIENT_IP_HEADER,
  CLIENT_IP_SECRET_HEADER,
]);

const RESPONSE_SKIP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
  'set-cookie',
]);

export function resolveApiOrigin(raw: string | undefined, isProd: boolean): string | null {
  const trimmed = (raw || '').trim().replace(/\/$/, '');
  const origin = trimmed.replace(/\/api\/v1$/i, '');
  if (origin) return origin;
  if (isProd) return null;
  return 'http://127.0.0.1:3001';
}

export function buildUpstreamUrl(origin: string, pathname: string, search = '') {
  const base = origin.replace(/\/$/, '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}${search}`;
}

export function forwardedRequestHeaders(
  input: Headers,
  cookie?: string | null,
  clientIpSecret?: string | null,
): Headers {
  const headers = new Headers();
  input.forEach((value, key) => {
    if (REQUEST_SKIP.has(key)) return;
    headers.set(key, value);
  });
  if (cookie) headers.set('cookie', cookie);

  const clientIp = resolveProxyClientIp(input);
  const secret = clientIpSecret?.trim();
  if (clientIp) {
    headers.set('x-real-ip', clientIp);
    headers.set('x-forwarded-for', clientIp);
    if (secret) {
      headers.set(CLIENT_IP_HEADER, clientIp);
      headers.set(CLIENT_IP_SECRET_HEADER, secret);
    }
  }
  return headers;
}

export function rewriteSetCookie(cookie: string) {
  return cookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !/^domain=/i.test(part))
    .join('; ');
}

export function readSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  return [];
}

export function clientResponseHeaders(upstream: Headers): Headers {
  const headers = new Headers();
  upstream.forEach((value, key) => {
    if (RESPONSE_SKIP.has(key)) return;
    headers.set(key, value);
  });
  const cookies = readSetCookies(upstream).map(rewriteSetCookie).filter(Boolean);
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  if (cookies.length) headers.set('cache-control', 'private, no-store');
  return headers;
}

type ProxyRequest = {
  method: string;
  headers: Headers;
  cookie?: string | null;
  clientIpSecret?: string | null;
  body?: BodyInit | null;
};

export async function proxyHttp(target: string, request: ProxyRequest): Promise<Response> {
  const method = request.method.toUpperCase();
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: forwardedRequestHeaders(request.headers, request.cookie, request.clientIpSecret),
    redirect: 'manual',
  };
  if (method !== 'GET' && method !== 'HEAD' && request.body != null) {
    init.body = request.body;
    init.duplex = 'half';
  }

  try {
    const upstream = await fetch(target, init);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: clientResponseHeaders(upstream.headers),
    });
  } catch {
    return new Response(JSON.stringify({ message: 'API no disponible' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
