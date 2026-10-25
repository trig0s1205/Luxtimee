import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import {
  buildUpstreamUrl,
  forwardedRequestHeaders,
  incomingRequestHeaders,
  proxyHttp,
  resolveApiOrigin,
  rewriteSetCookie,
} from './api-proxy';
import { isCloudflareIp } from './client-ip';

test('normaliza el origen del API', () => {
  assert.equal(resolveApiOrigin('https://api.example.run.app/api/v1/', true), 'https://api.example.run.app');
  assert.equal(resolveApiOrigin('', true), null);
  assert.equal(resolveApiOrigin('', false), 'http://127.0.0.1:3001');
  assert.equal(buildUpstreamUrl('https://api.example.run.app', '/api/v1/auth/me', '?x=1'), 'https://api.example.run.app/api/v1/auth/me?x=1');
});

test('Cookie múltiple no se une con coma', () => {
  const headers = incomingRequestHeaders({
    cookie: ['LUXTIMEE_access=aaa.bbb.ccc', 'LUXTIMEE_refresh=ddd.eee.fff', '_ga=GA1.1.1.1'],
    'x-forwarded-for': ['203.0.113.9', '104.16.1.1'],
  });
  assert.equal(
    headers.get('cookie'),
    'LUXTIMEE_access=aaa.bbb.ccc; LUXTIMEE_refresh=ddd.eee.fff; _ga=GA1.1.1.1',
  );
  assert.equal(headers.get('x-forwarded-for'), '203.0.113.9, 104.16.1.1');
});

test('dos Set-Cookie con Expires sobreviven separados', async () => {
  let seenCookie = '';
  const upstream = createServer((req, res) => {
    seenCookie = req.headers.cookie || '';
    res.statusCode = 201;
    res.setHeader('content-type', 'application/json');
    res.setHeader('set-cookie', [
      'LUXTIMEE_access=aaa.bbb.ccc; Max-Age=900; Path=/; Expires=Sun, 25 Oct 2026 21:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
      'LUXTIMEE_refresh=ddd.eee.fff; Max-Age=7776000; Path=/; Expires=Sat, 23 Jan 2027 21:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
    ]);
    res.end('{}');
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', () => resolve()));
  const { port } = upstream.address() as AddressInfo;
  try {
    const cookie = 'LUXTIMEE_access=old; LUXTIMEE_refresh=old; _ga=GA1.1.9.9';
    const response = await proxyHttp(`http://127.0.0.1:${port}/api/v1/auth/login`, {
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      cookie,
      body: '{}',
    });
    const cookies = response.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    assert.match(cookies[0], /^LUXTIMEE_access=aaa\.bbb\.ccc;/);
    assert.match(cookies[1], /^LUXTIMEE_refresh=ddd\.eee\.fff;/);
    assert.match(cookies[0], /Expires=Sun, 25 Oct 2026 21:00:00 GMT/);
    assert.equal(cookies.some((header) => header.includes(', LUXTIMEE_')), false);
    assert.equal(seenCookie, cookie);
  } finally {
    await new Promise<void>((resolve, reject) => {
      upstream.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('Set-Cookie pierde el Domain del upstream', () => {
  assert.equal(
    rewriteSetCookie('LUXTIMEE_access=abc; Path=/; HttpOnly; Domain=luxtime-api.run.app; SameSite=Lax'),
    'LUXTIMEE_access=abc; Path=/; HttpOnly; SameSite=Lax',
  );
});

test('reconoce las IPs de Cloudflare', () => {
  assert.equal(isCloudflareIp('104.16.1.1'), true);
  assert.equal(isCloudflareIp('198.51.100.20'), false);
  assert.equal(isCloudflareIp('2606:4700:10::1'), true);
  assert.equal(isCloudflareIp('2001:db8::1'), false);
});

test('CF-Connecting-IP solo vale si el peer es Cloudflare', () => {
  const viaCloudflare = new Headers({
    host: 'www.luxtimee.com',
    cookie: 'LUXTIMEE_access=abc',
    'x-real-ip': '104.16.1.1',
    'x-forwarded-for': '1.2.3.4, 203.0.113.8, 104.16.1.1',
    'cf-connecting-ip': '203.0.113.50',
    'x-luxtimee-client-ip': '198.51.100.9',
    'x-luxtimee-proxy-secret': 'spoofed',
  });
  const forwarded = forwardedRequestHeaders(viaCloudflare, 'LUXTIMEE_access=abc', 'real-secret');
  assert.equal(forwarded.get('cookie'), 'LUXTIMEE_access=abc');
  assert.equal(forwarded.get('host'), null);
  assert.equal(forwarded.get('x-luxtimee-client-ip'), '203.0.113.50');
  assert.equal(forwarded.get('x-luxtimee-proxy-secret'), 'real-secret');
  assert.equal(forwarded.get('x-forwarded-for'), '203.0.113.50');

  const directToVercel = new Headers({
    'x-real-ip': '198.51.100.20',
    'cf-connecting-ip': '203.0.113.50',
    'x-forwarded-for': '203.0.113.9, 198.51.100.20',
  });
  const direct = forwardedRequestHeaders(directToVercel, null, 'real-secret');
  assert.equal(direct.get('x-luxtimee-client-ip'), '198.51.100.20');
});

test('login, admin solo con cookie, refresh y logout', async () => {
  let access = 'access-1';
  let refresh = 'refresh-1';
  let accessValid = true;
  const seen: Array<{ authorization?: string; cookie?: string; host?: string }> = [];

  const upstream = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const cookie = req.headers.cookie || '';
      seen.push({
        authorization: req.headers.authorization,
        cookie,
        host: req.headers.host,
      });
      const send = (status: number, body: unknown, cookies?: string[]) => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        if (cookies?.length) res.setHeader('set-cookie', cookies);
        res.end(JSON.stringify(body));
      };

      if (req.url === '/api/v1/auth/login' && req.method === 'POST') {
        assert.match(Buffer.concat(chunks).toString(), /a@b.c/);
        send(200, { user: { id: '1' } }, [
          `LUXTIMEE_access=${access}; Path=/; HttpOnly; Domain=upstream.internal; SameSite=Lax`,
          `LUXTIMEE_refresh=${refresh}; Path=/; HttpOnly; Domain=upstream.internal; SameSite=Lax`,
        ]);
        return;
      }
      if (req.url === '/api/v1/admin/ping') {
        if (!cookie.includes(`LUXTIMEE_access=${access}`) || !accessValid) {
          send(401, { message: 'Sesión inválida o expirada' });
          return;
        }
        send(200, { ok: true });
        return;
      }
      if (req.url === '/api/v1/auth/expire') {
        accessValid = false;
        send(200, { ok: true });
        return;
      }
      if (req.url === '/api/v1/auth/refresh') {
        if (!cookie.includes(`LUXTIMEE_refresh=${refresh}`)) {
          send(401, { message: 'Refresh token no encontrado' });
          return;
        }
        access = 'access-2';
        refresh = 'refresh-2';
        accessValid = true;
        send(200, { ok: true }, [
          `LUXTIMEE_access=${access}; Path=/; HttpOnly; SameSite=Lax`,
          `LUXTIMEE_refresh=${refresh}; Path=/; HttpOnly; SameSite=Lax`,
        ]);
        return;
      }
      if (req.url === '/api/v1/auth/logout') {
        if (!cookie.includes('LUXTIMEE_access=')) {
          send(401, { message: 'Sesión inválida o expirada' });
          return;
        }
        send(200, { ok: true }, [
          'LUXTIMEE_access=; Path=/; Max-Age=0; HttpOnly',
          'LUXTIMEE_refresh=; Path=/; Max-Age=0; HttpOnly',
        ]);
        return;
      }
      send(404, {});
    });
  });

  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', () => resolve()));
  const { port } = upstream.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;
  const jar = new Map<string, string>();

  function remember(response: Response) {
    const cookies = response.headers.getSetCookie();
    assert.ok(cookies.length > 0);
    for (const header of cookies) {
      assert.equal(/domain=/i.test(header), false);
      const pair = header.split(';')[0];
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      if (/max-age=\s*0/i.test(header)) jar.delete(name);
      else jar.set(name, pair.slice(eq + 1).trim());
    }
  }

  function cookieHeader() {
    return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  async function call(path: string, method: string, cookie = cookieHeader()) {
    const headers = new Headers({
      'content-type': 'application/json',
      host: 'www.luxtimee.com',
      'x-real-ip': '104.16.1.1',
      'cf-connecting-ip': '203.0.113.50',
      'x-forwarded-for': '1.2.3.4, 104.16.1.1',
    });
    return proxyHttp(`${origin}${path}`, {
      method,
      headers,
      cookie,
      clientIpSecret: 'edge-secret',
      body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify({ email: 'a@b.c', password: 'x' }),
    });
  }

  try {
    const login = await call('/api/v1/auth/login', 'POST', '');
    assert.equal(login.status, 200);
    assert.equal(login.headers.getSetCookie().length, 2);
    assert.match(login.headers.get('cache-control') || '', /no-store/);
    remember(login);
    assert.equal(seen[0]?.host, `127.0.0.1:${port}`);

    assert.equal((await call('/api/v1/admin/ping', 'GET', '')).status, 401);

    const authed = await call('/api/v1/admin/ping', 'GET');
    assert.equal(authed.status, 200);
    assert.equal((await authed.json() as { ok: boolean }).ok, true);
    assert.equal(seen.at(-1)?.authorization, undefined);
    assert.match(seen.at(-1)?.cookie || '', /LUXTIMEE_access=access-1/);

    assert.equal((await call('/api/v1/auth/expire', 'POST')).status, 200);
    assert.equal((await call('/api/v1/admin/ping', 'GET')).status, 401);

    const refreshed = await call('/api/v1/auth/refresh', 'POST');
    assert.equal(refreshed.status, 200);
    remember(refreshed);
    assert.equal(jar.get('LUXTIMEE_access'), 'access-2');
    assert.equal((await call('/api/v1/admin/ping', 'GET')).status, 200);

    const logout = await call('/api/v1/auth/logout', 'POST');
    assert.equal(logout.status, 200);
    remember(logout);
    assert.equal(jar.has('LUXTIMEE_access'), false);
    assert.equal((await call('/api/v1/admin/ping', 'GET')).status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => {
      upstream.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
