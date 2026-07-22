import type { AuthUserDto } from '@luxtime/shared';
import { Role } from '@luxtime/shared';

const STAFF_ROLES = new Set<Role>([Role.ADMIN, Role.SUPER_ADMIN]);

export const AUTH_REDIRECT_KEY = 'luxtime_auth_redirect';

export function isSafeRedirect(path: string | undefined | null): path is string {
  if (!path) return false;
  return path.startsWith('/') && !path.startsWith('//');
}

export function resolvePostLoginRedirect(user: AuthUserDto, requested?: string | null): string {
  if (!STAFF_ROLES.has(user.role)) {
    return '/ingresar?error=forbidden';
  }

  const path = requested?.trim();
  if (isSafeRedirect(path) && path.startsWith('/admin') && !path.startsWith('/ingresar')) {
    return path;
  }

  return '/admin/inventario';
}

export function storeAuthRedirect(path: string) {
  if (!import.meta.client || !isSafeRedirect(path)) return;
  sessionStorage.setItem(AUTH_REDIRECT_KEY, path);
}

export function consumeAuthRedirect(): string | null {
  if (!import.meta.client) return null;
  const path = sessionStorage.getItem(AUTH_REDIRECT_KEY);
  sessionStorage.removeItem(AUTH_REDIRECT_KEY);
  return path;
}
