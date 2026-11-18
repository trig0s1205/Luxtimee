import { defineStore } from 'pinia';
import type { AuthSessionDto, AuthUserDto } from '@luxtime/shared';
import { Role } from '@luxtime/shared';
import {
  clearLegacyStoredTokens,
  clearStoredTokens,
  loadStoredUser,
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
import {
  isAuthRejectedError,
  isTransientRequestError,
  isUnauthorizedError,
} from '~/utils/api-error-kind';

function isStaffUser(user: AuthUserDto | null | { role: string }) {
  return user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN
    || user?.role === Role.VENDEDOR_LOCAL
    || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
    || user?.role === 'VENDEDOR_LOCAL';
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
    isLocalSeller: (state) => state.user?.role === 'VENDEDOR_LOCAL',
    canUsePanel: (state) =>
      state.user?.role === 'ADMIN'
      || state.user?.role === 'SUPER_ADMIN'
      || state.user?.role === 'VENDEDOR_LOCAL',
    isSuperAdmin: (state) => state.user?.role === 'SUPER_ADMIN',
    hasApiSession: (state) =>
      !state.isLocalSession
      && (state.user?.role === 'ADMIN'
        || state.user?.role === 'SUPER_ADMIN'
        || state.user?.role === 'VENDEDOR_LOCAL'),
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
    /** Restaura el usuario staff guardado si Pinia aún no tiene sesión (p. ej. tras F5). */
    hydrateStoredStaff() {
      if (this.user) return;
      const stored = loadStoredUser();
      if (stored && isStaffUser(stored)) {
        this.setUser(stored as AuthUserDto, false);
      }
    },
    hydrateTokens() {
      clearLegacyStoredTokens();
    },
    clearStaffSession() {
      this.setUser(null, false);
      this.clearUploadToken();
      if (import.meta.client) saveStoredUser(null);
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
        if (!isUnauthorizedError(err)) throw err;
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
      this.hydrateStoredStaff();
      const baseUrl = useApiBaseUrl();
      const fetchOptions = {
        credentials: 'include' as const,
        timeout: AUTH_TIMEOUT_MS,
        retry: 0 as const,
      };

      const applyStaffUser = (user: AuthUserDto) => {
        clearLocalSession();
        this.setUser(user, false);
        if (import.meta.client) saveStoredUser(user);
      };

      try {
        const data = await apiFetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, fetchOptions);
        if (isStaffUser(data.user)) {
          applyStaffUser(data.user);
        } else {
          this.clearStaffSession();
        }
        return;
      } catch (err) {
        // Red / 5xx: conservar la sesión en memoria o en localStorage.
        if (isTransientRequestError(err)) {
          if (isStaffUser(this.user)) return;
          this.hydrateStoredStaff();
          if (LOCAL_AUTH_ENABLED) {
            const local = loadLocalSession();
            if (local && isStaffUser(local)) this.setUser(local, true);
          }
          return;
        }

        if (allowRefresh && isAuthRejectedError(err)) {
          try {
            await this.refreshSession();
            const data = await apiFetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, fetchOptions);
            if (isStaffUser(data.user)) {
              applyStaffUser(data.user);
              return;
            }
          } catch (refreshErr) {
            if (isTransientRequestError(refreshErr)) {
              if (isStaffUser(this.user)) return;
              this.hydrateStoredStaff();
              return;
            }
          }
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

        // Solo cerrar si el servidor rechazó de verdad la sesión (401/403).
        if (isAuthRejectedError(err)) {
          this.clearStaffSession();
        }
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
