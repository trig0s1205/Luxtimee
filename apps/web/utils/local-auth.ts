import { Role, type AuthUserDto } from '@luxtime/shared';

const STORAGE_KEY = 'luxtime-dev-auth';

const DEV_ACCOUNTS: Record<string, { password: string; name: string; role: Role }> = {
  'alvaro@luxtime.co': { password: 'luxtime', name: 'Álvaro', role: Role.SUPER_ADMIN },
  'lidia@luxtime.co': { password: 'luxtime', name: 'Lidia', role: Role.ADMIN },
};

export const LOCAL_AUTH_ENABLED = import.meta.dev;

export function validateLocalLogin(email: string, password: string): AuthUserDto | null {
  const key = email.trim().toLowerCase();
  const account = DEV_ACCOUNTS[key];
  if (!account || account.password !== password) return null;

  return {
    id: `local-${key}`,
    email: key,
    name: account.name,
    role: account.role,
  };
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

export const DEV_ACCOUNT_HINTS = Object.entries(DEV_ACCOUNTS).map(([email, data]) => ({
  email,
  name: data.name,
  role: data.role,
  password: data.password,
}));
