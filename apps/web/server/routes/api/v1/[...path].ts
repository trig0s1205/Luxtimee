import { Readable } from 'node:stream';
import {
  appendResponseHeader,
  createError,
  getRequestHeader,
  getRequestHeaders,
  getRequestURL,
  readRawBody,
  sendStream,
  setResponseHeader,
  setResponseStatus,
} from 'h3';
import { buildUpstreamUrl, proxyHttp, readSetCookies, resolveApiOrigin } from '../../../utils/api-proxy';

function headerEntries(source: ReturnType<typeof getRequestHeaders>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(source)) {
    if (!value) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const origin = resolveApiOrigin(
    String(config.apiUpstreamUrl || ''),
    process.env.NODE_ENV === 'production',
  );
  if (!origin) {
    throw createError({ statusCode: 502, statusMessage: 'API upstream no configurado' });
  }

  const url = getRequestURL(event);
  let upstreamHost = '';
  try {
    upstreamHost = new URL(origin).host;
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'API upstream inválido' });
  }
  if (upstreamHost === url.host) {
    throw createError({ statusCode: 508, statusMessage: 'Proxy loop' });
  }

  const method = event.method.toUpperCase();
  let body: Buffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const raw = await readRawBody(event, false);
    if (typeof raw === 'string') body = Buffer.from(raw);
    else if (raw) body = raw;
  }

  const response = await proxyHttp(buildUpstreamUrl(origin, url.pathname, url.search), {
    method,
    headers: headerEntries(getRequestHeaders(event)),
    cookie: getRequestHeader(event, 'cookie'),
    clientIpSecret: String(config.clientIpSecret || ''),
    body: body ? new Uint8Array(body) : undefined,
  });

  setResponseStatus(event, response.status, response.statusText);
  response.headers.forEach((value, key) => {
    if (key === 'set-cookie') return;
    setResponseHeader(event, key, value);
  });
  for (const cookie of readSetCookies(response.headers)) {
    appendResponseHeader(event, 'set-cookie', cookie);
  }

  if (!response.body) return null;
  return sendStream(event, Readable.fromWeb(response.body as import('node:stream/web').ReadableStream));
});
