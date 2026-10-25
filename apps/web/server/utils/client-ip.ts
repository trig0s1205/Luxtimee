const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

/** Rangos publicados en https://www.cloudflare.com/ips-v4 y ips-v6 (2026-10-25). */
const CLOUDFLARE_IPV4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

const CLOUDFLARE_IPV6 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

export const CLIENT_IP_HEADER = 'x-luxtimee-client-ip';
export const CLIENT_IP_SECRET_HEADER = 'x-luxtimee-proxy-secret';

export function isIpToken(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (IPV4.test(trimmed)) return true;
  if (trimmed.length > 64 || !trimmed.includes(':')) return false;
  return ipv6ToBig(trimmed) != null;
}

function ipv4ToInt(ip: string) {
  if (!IPV4.test(ip)) return null;
  const parts = ip.split('.').map(Number);
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function ipv4InCidr(ip: string, cidr: string) {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt == null || rangeInt == null || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function ipv6ToBig(ip: string) {
  let value = ip.trim().toLowerCase();
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
  const zone = value.indexOf('%');
  if (zone !== -1) value = value.slice(0, zone);
  if (!value.includes(':')) return null;
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - (left.length + right.length);
  if (halves.length === 2 && missing < 0) return null;
  const groups = halves.length === 2 ? [...left, ...Array(missing).fill('0'), ...right] : left;
  if (groups.length !== 8) return null;
  let out = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    out = (out << 16n) + BigInt(parseInt(group, 16));
  }
  return out;
}

function ipv6InCidr(ip: string, cidr: string) {
  const [range, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const ipInt = ipv6ToBig(ip);
  const rangeInt = ipv6ToBig(range);
  if (ipInt == null || rangeInt == null || bits < 0 || bits > 128) return false;
  if (bits === 0) return true;
  const shift = BigInt(128 - bits);
  return (ipInt >> shift) === (rangeInt >> shift);
}

export function isCloudflareIp(value: string | null | undefined) {
  if (!value || !isIpToken(value)) return false;
  const ip = value.trim();
  if (ip.includes(':')) return CLOUDFLARE_IPV6.some((cidr) => ipv6InCidr(ip, cidr));
  return CLOUDFLARE_IPV4.some((cidr) => ipv4InCidr(ip, cidr));
}

function rightmostIp(header: string | null) {
  if (!header) return null;
  const parts = header.split(',').map((part) => part.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (isIpToken(parts[i])) return parts[i];
  }
  return null;
}

/**
 * IP del visitante vista en Vercel.
 * CF-Connecting-IP solo cuenta si el peer (x-real-ip) es Cloudflare:
 * si no, el header se puede falsificar pegándole al dominio de Vercel.
 */
export function resolveProxyClientIp(headers: Headers) {
  const peer = rightmostIp(headers.get('x-real-ip')) || rightmostIp(headers.get('x-forwarded-for'));
  const cloudflareClient = rightmostIp(headers.get('cf-connecting-ip'));
  if (cloudflareClient && peer && isCloudflareIp(peer)) return cloudflareClient;
  if (peer && !isCloudflareIp(peer)) return peer;
  return null;
}
