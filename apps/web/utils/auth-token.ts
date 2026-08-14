const ACCESS_KEY = 'luxtimee_access';
const REFRESH_KEY = 'luxtimee_refresh';

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
}

export function authFetchHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}
