import type { FetchContext, FetchOptions } from 'ofetch';
import { mergeCookieHeader } from '~/utils/cookie-jar';

const jars = new WeakMap<object, string>();

function serverCookieJar() {
  if (!import.meta.server) return null;
  try {
    const event = useRequestEvent();
    if (!event) return null;
    return {
      get() {
        const existing = jars.get(event);
        if (existing !== undefined) return existing;
        const incoming = useRequestHeaders(['cookie']).cookie || '';
        jars.set(event, incoming);
        return incoming;
      },
      set(value: string) {
        jars.set(event, value);
      },
    };
  } catch {
    return null;
  }
}

function readSetCookies(headers: Headers) {
  return typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
}

export function apiFetch<T>(request: string, options: FetchOptions = {}) {
  const jar = serverCookieJar();
  const headers = new Headers(options.headers as HeadersInit | undefined);
  const cookie = jar?.get();
  if (cookie && !headers.has('cookie')) headers.set('cookie', cookie);
  const previous = options.onResponse;

  const nextOptions = {
    ...options,
    credentials: options.credentials ?? 'include',
    headers,
    async onResponse(context: FetchContext) {
      const response = context.response;
      if (jar && response) {
        const setCookies = readSetCookies(response.headers);
        if (setCookies.length) jar.set(mergeCookieHeader(jar.get(), setCookies));
      }
      if (!response || !previous) return;
      const settled = context as FetchContext & { response: NonNullable<FetchContext['response']> };
      if (typeof previous === 'function') await previous(settled);
      else {
        for (const hook of previous) await hook(settled);
      }
    },
  } as FetchOptions;

  return $fetch<T>(request, nextOptions as Parameters<typeof $fetch>[1]);
}
