function isExpiredSetCookie(header: string) {
  const attrs = header.slice(header.indexOf(';') + 1).toLowerCase();
  return /(?:^|;)\s*max-age=\s*0(?:\s|;|$)/i.test(header)
    || attrs.includes('expires=thu, 01 jan 1970');
}

export function mergeCookieHeader(current: string, setCookies: string[]) {
  const jar = new Map<string, string>();
  for (const part of current.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    jar.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }

  for (const header of setCookies) {
    if (!header) continue;
    const semi = header.indexOf(';');
    const pair = (semi === -1 ? header : header.slice(0, semi)).trim();
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    if (semi !== -1 && isExpiredSetCookie(header)) jar.delete(name);
    else jar.set(name, pair.slice(eq + 1).trim());
  }

  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}
