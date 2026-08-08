import type { AuthUserDto } from '@luxtime/shared';

const STORAGE_KEY = 'LUXTIMEE-dev-auth';

export const LOCAL_AUTH_ENABLED = false;

export function validateLocalLogin(_email: string, _password: string): AuthUserDto | null {
  return null;
}

export function saveLocalSession(user: AuthUserDto) {
  if (!import.meta.client) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function loadLocalSession(): AuthUserDto | null {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as AuthUserDto;
    return user?.email && user?.role ? user : null;
  } catch {
    return null;
  }
}

export function clearLocalSession() {
  if (!import.meta.client) return;
  localStorage.removeItem(STORAGE_KEY);
}
