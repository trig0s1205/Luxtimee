const ACCESS_KEY = 'luxtimee_access';
const REFRESH_KEY = 'luxtimee_refresh';
const USER_KEY = 'luxtimee_user';

export function loadStoredTokens() {
  if (!import.meta.client) {
    return { accessToken: null as string | null, refreshToken: null as string | null };
  }
  return {
    accessToken: localStorage.getItem(ACCESS_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
  };
}

export function saveStoredTokens(accessToken: string | null, refreshToken?: string | null) {
  if (!import.meta.client) return;
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  else localStorage.removeItem(ACCESS_KEY);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else if (refreshToken === null) localStorage.removeItem(REFRESH_KEY);
}

export function clearStoredTokens() {
  saveStoredTokens(null, null);
  if (import.meta.client) localStorage.removeItem(USER_KEY);
}

export function saveStoredUser(user: { id: string; email: string; name: string; role: string } | null) {
  if (!import.meta.client) return;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function loadStoredUser<T extends { id: string; email: string; name: string; role: string }>(): T | null {
  if (!import.meta.client) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function resolveAccessToken(current: string | null): string | null {
  if (current) return current;
  return loadStoredTokens().accessToken;
}

export function authFetchHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}
