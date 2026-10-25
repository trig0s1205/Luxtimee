import { CANONICAL_ORIGIN } from '../../utils/seo';

const CANONICAL = new URL(CANONICAL_ORIGIN);
const APEX_HOST = CANONICAL.hostname.replace(/^www\./, '');

export function normalizeHost(value: string | undefined | null) {
  return (value || '')
    .split(',')[0]
    .trim()
    .replace(/:\d+$/, '')
    .toLowerCase();
}

export function requestHost(
  forwardedHost: string | undefined | null,
  host: string | undefined | null,
) {
  return normalizeHost(forwardedHost) || normalizeHost(host);
}

export function apexRedirectTarget(host: string, pathname: string, search = '') {
  if (normalizeHost(host) !== APEX_HOST) return null;
  if (CANONICAL.hostname === APEX_HOST) return null;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${CANONICAL.origin}${path}${search}`;
}
