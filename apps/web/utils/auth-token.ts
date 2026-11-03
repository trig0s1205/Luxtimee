const ACCESS_KEY = 'luxtimee_access';
const REFRESH_KEY = 'luxtimee_refresh';
const USER_KEY = 'luxtimee_user';

export function clearLegacyStoredTokens() {
  if (!import.meta.client) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function clearStoredTokens() {
  clearLegacyStoredTokens();
  if (import.meta.client) localStorage.removeItem(USER_KEY);
}

export function saveStoredUser(user: { id: string; email: string; name: string; role: string } | null) {
  if (!import.meta.client) return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function loadStoredUser(): { id: string; email: string; name: string; role: string } | null {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; email?: string; name?: string; role?: string };
    if (!parsed?.id || !parsed.email || !parsed.name || !parsed.role) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export function authFetchHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}

export function readJwtExpMs(token: string) {
  try {
    const part = token.split('.')[1];
    if (!part) return 0;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(padded)) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}
