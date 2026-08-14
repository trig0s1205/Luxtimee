const ACCESS_KEY = 'luxtimee_access';
const REFRESH_KEY = 'luxtimee_refresh';
const USER_KEY = 'luxtimee_user';

export function loadStoredTokens() {
  if (!import.meta.client) {
    return { accessToken: null as string | null, refreshToken: null as string | null };
  }
  return {
    accessToken: sessionStorage.getItem(ACCESS_KEY),
    refreshToken: sessionStorage.getItem(REFRESH_KEY),
  };
}

export function saveStoredTokens(accessToken: string | null, refreshToken?: string | null) {
  if (!import.meta.client) return;
  if (accessToken) sessionStorage.setItem(ACCESS_KEY, accessToken);
  else sessionStorage.removeItem(ACCESS_KEY);
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  else if (refreshToken === null) sessionStorage.removeItem(REFRESH_KEY);
}

export function clearStoredTokens() {
  saveStoredTokens(null, null);
  if (import.meta.client) sessionStorage.removeItem(USER_KEY);
}

export function saveStoredUser(user: { id: string; email: string; name: string; role: string } | null) {
  if (!import.meta.client) return;
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(USER_KEY);
}

export function loadStoredUser<T extends { id: string; email: string; name: string; role: string }>(): T | null {
  if (!import.meta.client) return null;
  const raw = sessionStorage.getItem(USER_KEY);
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
