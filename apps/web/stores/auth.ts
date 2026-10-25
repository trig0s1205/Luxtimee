import { defineStore } from 'pinia';
import type { AuthSessionDto, AuthUserDto } from '@luxtime/shared';
import { Role } from '@luxtime/shared';
import {
  clearLegacyStoredTokens,
  clearStoredTokens,
  readJwtExpMs,
  saveStoredUser,
} from '~/utils/auth-token';
import {
  clearLocalSession,
  loadLocalSession,
  LOCAL_AUTH_ENABLED,
  saveLocalSession,
  validateLocalLogin,
} from '~/utils/local-auth';
import { invalidateStaffAdminCaches } from '~/utils/admin-cache';
import { AUTH_REDIRECT_KEY } from '~/utils/auth-redirect';
import { AUTH_TIMEOUT_MS } from '~/utils/api-timeout';

function isUnauthorized(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const status = (err as { statusCode?: number; status?: number }).statusCode
    ?? (err as { status?: number }).status;
  return status === 401;
}

function isStaffUser(user: AuthUserDto | null) {
  return user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUserDto | null,
    loaded: false,
    isLocalSession: false,
    sessionCheckedAt: 0,
    uploadToken: null as string | null,
    uploadTokenExp: 0,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    isStaff: (state) => state.user?.role === 'ADMIN' || state.user?.role === 'SUPER_ADMIN',
    isSuperAdmin: (state) => state.user?.role === 'SUPER_ADMIN',
    hasApiSession: (state) =>
      !state.isLocalSession
      && (state.user?.role === 'ADMIN' || state.user?.role === 'SUPER_ADMIN'),
  },
  actions: {
    setUser(user: AuthUserDto | null, isLocalSession = false) {
      this.user = user;
      this.isLocalSession = isLocalSession;
      this.loaded = true;
      if (user) this.sessionCheckedAt = Date.now();
    },
    hydrateLocal() {
      if (!LOCAL_AUTH_ENABLED) return;
      const local = loadLocalSession();
      if (local && isStaffUser(local)) {
        this.setUser(local, true);
      }
    },
    hydrateTokens() {
      clearLegacyStoredTokens();
    },
    clearUploadToken() {
      this.uploadToken = null;
      this.uploadTokenExp = 0;
    },
    applySession(data: AuthSessionDto, isLocalSession = false) {
      clearLocalSession();
      clearLegacyStoredTokens();
      this.clearUploadToken();
      this.setUser(data.user, isLocalSession);
      if (import.meta.client && isStaffUser(data.user)) {
        saveStoredUser(data.user);
        invalidateStaffAdminCaches();
      }
    },
    async refreshSession() {
      const baseUrl = useApiBaseUrl();
      await apiFetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        timeout: AUTH_TIMEOUT_MS,
        retry: 0,
      });
    },
    async ensureUploadToken(force = false): Promise<string> {
      if (!force && this.uploadToken && this.uploadTokenExp > Date.now() + 15_000) {
        return this.uploadToken;
      }
      const baseUrl = useApiBaseUrl();
      const requestToken = () => apiFetch<{ accessToken?: string }>(`${baseUrl}/auth/upload-token`, {
        method: 'POST',
        credentials: 'include',
        timeout: AUTH_TIMEOUT_MS,
        retry: 0,
      });
      let data: { accessToken?: string };
      try {
        data = await requestToken();
      } catch (err) {
        if (!isUnauthorized(err)) throw err;
        await this.refreshSession();
        data = await requestToken();
      }
      if (!data.accessToken) {
        throw new Error('Tu sesión expiró. Cierra sesión e ingresa de nuevo.');
      }
      this.uploadToken = data.accessToken;
      this.uploadTokenExp = readJwtExpMs(data.accessToken);
      return data.accessToken;
    },
    async fetchMe(options: { allowRefresh?: boolean } = {}) {
      const { allowRefresh = true } = options;
      this.hydrateTokens();
      const baseUrl = useApiBaseUrl();
      const fetchOptions = {
        credentials: 'include' as const,
        timeout: AUTH_TIMEOUT_MS,
        retry: 0 as const,
      };

      try {
        const data = await apiFetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, fetchOptions);
        if (isStaffUser(data.user)) {
          clearLocalSession();
          this.setUser(data.user, false);
          if (import.meta.client) saveStoredUser(data.user);
        } else {
          this.setUser(null, false);
          if (import.meta.client) saveStoredUser(null);
        }
        return;
      } catch {
        if (allowRefresh) {
          try {
            await this.refreshSession();
            const data = await apiFetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, fetchOptions);
            if (isStaffUser(data.user)) {
              clearLocalSession();
              this.setUser(data.user, false);
              if (import.meta.client) saveStoredUser(data.user);
              return;
            }
          } catch { /* refresh falló */ }
        }

        if (LOCAL_AUTH_ENABLED) {
          const local = loadLocalSession();
          if (local && isStaffUser(local)) {
            this.setUser(local, true);
            return;
          }
        }

        if (isStaffUser(this.user) && Date.now() - this.sessionCheckedAt < 30_000) {
          return;
        }

        const hadStaffSession = isStaffUser(this.user);
        this.setUser(null, false);
        this.clearUploadToken();
        if (hadStaffSession && import.meta.client) saveStoredUser(null);
      }
    },
    localLogin(email: string, password: string) {
      if (!LOCAL_AUTH_ENABLED) {
        throw new Error('Login local solo disponible en desarrollo.');
      }
      const user = validateLocalLogin(email, password);
      if (!user) {
        throw new Error('Correo o contraseña incorrectos.');
      }
      saveLocalSession(user);
      this.setUser(user, true);
      return user;
    },
    async mockLogin(email: string, name: string) {
      const baseUrl = useApiBaseUrl();
      const data = await apiFetch<AuthSessionDto>(`${baseUrl}/auth/mock-login`, {
        method: 'POST',
        body: { email, name },
        credentials: 'include',
      });
      this.applySession(data, false);
      return data.user;
    },
    async credentialLogin(email: string, password: string) {
      const baseUrl = useApiBaseUrl();
      const data = await apiFetch<AuthSessionDto>(`${baseUrl}/auth/login`, {
        method: 'POST',
        body: { email: email.trim(), password },
        credentials: 'include',
      });
      this.applySession(data, false);
      return data.user;
    },
    async logout() {
      clearLocalSession();
      clearStoredTokens();
      this.clearUploadToken();
      if (import.meta.client) {
        sessionStorage.removeItem(AUTH_REDIRECT_KEY);
      }
      const baseUrl = useApiBaseUrl();
      const callLogout = () => apiFetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        timeout: AUTH_TIMEOUT_MS,
        retry: 0,
      });
      try {
        await callLogout();
      } catch {
        try {
          await this.refreshSession();
          await callLogout();
        } catch { /* */ }
      }
      this.setUser(null, false);
      this.loaded = false;
      if (import.meta.client) invalidateStaffAdminCaches();
    },
  },
});
