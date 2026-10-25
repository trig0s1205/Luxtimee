import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = resolve(webRoot, '.output/server/index.mjs');
const upstreamPort = 4017;
const webPort = 3210;
const secret = 'edge-secret';

if (!existsSync(serverEntry)) {
  console.error('Falta el build: pnpm --filter @luxtime/web build');
  process.exit(1);
}

function send(res, status, body, cookies) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  if (cookies?.length) res.setHeader('set-cookie', cookies);
  res.end(JSON.stringify(body));
}

let access = 'access-1';
let refresh = 'refresh-1';
let accessValid = true;
const seen = [];

const upstream = createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const cookie = req.headers.cookie || '';
    seen.push({
      url: req.url,
      cookie,
      authorization: req.headers.authorization,
      clientIp: req.headers['x-luxtimee-client-ip'],
      secret: req.headers['x-luxtimee-proxy-secret'],
      xff: req.headers['x-forwarded-for'],
    });
    if (req.url === '/api/v1/auth/login') {
      send(res, 200, { user: { id: '1' } }, [
        `LUXTIMEE_access=${access}; Path=/; HttpOnly; Domain=upstream.internal; SameSite=Lax`,
        `LUXTIMEE_refresh=${refresh}; Path=/; HttpOnly; Domain=upstream.internal; SameSite=Lax`,
      ]);
      return;
    }
    if (req.url === '/api/v1/admin/ping') {
      if (!cookie.includes(`LUXTIMEE_access=${access}`) || !accessValid) {
        send(res, 401, { message: 'Sesión inválida o expirada' });
        return;
      }
      send(res, 200, { ok: true });
      return;
    }
    if (req.url === '/api/v1/auth/expire') {
      accessValid = false;
      send(res, 200, { ok: true });
      return;
    }
    if (req.url === '/api/v1/auth/refresh') {
      if (!cookie.includes(`LUXTIMEE_refresh=${refresh}`)) {
        send(res, 401, { message: 'Refresh token no encontrado' });
        return;
      }
      access = 'access-2';
      refresh = 'refresh-2';
      accessValid = true;
      send(res, 200, { ok: true }, [
        `LUXTIMEE_access=${access}; Path=/; HttpOnly; SameSite=Lax`,
        `LUXTIMEE_refresh=${refresh}; Path=/; HttpOnly; SameSite=Lax`,
      ]);
      return;
    }
    if (req.url === '/api/v1/auth/logout') {
      if (!cookie.includes('LUXTIMEE_access=')) {
        send(res, 401, { message: 'Sesión inválida o expirada' });
        return;
      }
      send(res, 200, { ok: true }, [
        'LUXTIMEE_access=; Path=/; Max-Age=0; HttpOnly',
        'LUXTIMEE_refresh=; Path=/; Max-Age=0; HttpOnly',
      ]);
      return;
    }
    send(res, 404, { message: 'no' });
  });
});

await new Promise((resolve) => upstream.listen(upstreamPort, '127.0.0.1', resolve));

const child = spawn(process.execPath, [serverEntry], {
  cwd: webRoot,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(webPort),
    NITRO_HOST: '127.0.0.1',
    NITRO_PORT: String(webPort),
    NUXT_API_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
    NUXT_CLIENT_IP_SECRET: secret,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (chunk) => { logs += chunk; });
child.stderr.on('data', (chunk) => { logs += chunk; });

const base = `http://127.0.0.1:${webPort}`;

async function waitReady() {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(`${base}/api/v1/admin/ping`);
      if (response.status === 401 || response.status === 200) return;
    } catch {
      /* aún arranca */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`el servidor no arrancó\n${logs}`);
}

function remember(response, jar) {
  const cookies = response.headers.getSetCookie();
  if (!cookies.length) throw new Error('faltan Set-Cookie');
  for (const header of cookies) {
    if (/domain=/i.test(header)) throw new Error(`Domain no debe viajar: ${header}`);
    const pair = header.split(';')[0];
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq).trim();
    if (/max-age=\s*0/i.test(header)) jar.delete(name);
    else jar.set(name, pair.slice(eq + 1).trim());
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function call(path, method, jar, extraHeaders = {}) {
  const headers = { 'content-type': 'application/json', ...extraHeaders };
  const cookie = cookieHeader(jar);
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify({ email: 'a@b.c', password: 'x' }),
    redirect: 'manual',
  });
  return response;
}

try {
  await waitReady();
  const jar = new Map();
  const login = await call('/api/v1/auth/login', 'POST', jar, {
    'x-real-ip': '104.16.1.1',
    'cf-connecting-ip': '203.0.113.50',
    'x-forwarded-for': '1.2.3.4, 104.16.1.1',
    'x-luxtimee-proxy-secret': 'spoofed',
  });
  if (login.status !== 200) throw new Error(`login ${login.status}`);
  if (login.headers.getSetCookie().length !== 2) throw new Error('login no devolvió las dos cookies');
  remember(login, jar);

  const anon = await call('/api/v1/admin/ping', 'GET', new Map());
  if (anon.status !== 401) throw new Error(`anon ${anon.status}`);

  const authed = await call('/api/v1/admin/ping', 'GET', jar);
  if (authed.status !== 200) throw new Error(`admin ${authed.status} ${await authed.text()}`);
  const adminHit = seen.filter((item) => item.url === '/api/v1/admin/ping').at(-1);
  if (adminHit?.authorization) throw new Error('el admin no debe exigir Authorization');
  if (!String(adminHit?.cookie || '').includes('LUXTIMEE_access=access-1')) {
    throw new Error(`cookie no llegó al API: ${adminHit?.cookie}`);
  }

  const signed = seen.find((item) => item.url === '/api/v1/auth/login');
  if (signed?.clientIp !== '203.0.113.50' || signed?.secret !== secret) {
    throw new Error(`IP firmada inesperada ${signed?.clientIp} ${signed?.xff}`);
  }

  if ((await call('/api/v1/auth/expire', 'POST', jar)).status !== 200) throw new Error('expire');
  if ((await call('/api/v1/admin/ping', 'GET', jar)).status !== 401) throw new Error('debía expirar');
  const refreshed = await call('/api/v1/auth/refresh', 'POST', jar);
  if (refreshed.status !== 200) throw new Error(`refresh ${refreshed.status}`);
  remember(refreshed, jar);
  if (jar.get('LUXTIMEE_access') !== 'access-2') throw new Error('el refresh no rotó el access');
  if ((await call('/api/v1/admin/ping', 'GET', jar)).status !== 200) throw new Error('admin tras refresh');

  const logout = await call('/api/v1/auth/logout', 'POST', jar);
  if (logout.status !== 200) throw new Error(`logout ${logout.status}`);
  remember(logout, jar);
  if ((await call('/api/v1/admin/ping', 'GET', jar)).status !== 401) throw new Error('sesión sigue viva');

  const apex = await fetch(`${base}/acceso/demo?x=1`, {
    headers: { 'x-forwarded-host': 'luxtimee.com' },
    redirect: 'manual',
  });
  if (apex.status !== 308) throw new Error(`apex ${apex.status}`);
  const location = apex.headers.get('location') || '';
  if (location !== 'https://www.luxtimee.com/acceso/demo?x=1') {
    throw new Error(`redirect apex: ${location}`);
  }

  console.log('proxy cookie smoke ok');
} catch (error) {
  console.error(error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await once(child, 'exit').catch(() => undefined);
  await new Promise((resolve) => upstream.close(resolve));
}
