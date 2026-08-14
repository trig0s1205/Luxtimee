import { defineStore } from 'pinia';
import type { AuthRefreshDto, AuthSessionDto, AuthUserDto } from '@luxtime/shared';
import { Role } from '@luxtime/shared';
import {
  authFetchHeaders,
  clearStoredTokens,
  loadStoredTokens,
  saveStoredTokens,
} from '~/utils/auth-token';
import {
  clearLocalSession,
  loadLocalSession,
  LOCAL_AUTH_ENABLED,
  saveLocalSession,
  validateLocalLogin,
} from '~/utils/local-auth';
import { AUTH_REDIRECT_KEY } from '~/utils/auth-redirect';

function isStaffUser(user: AuthUserDto | null) {
  return user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUserDto | null,
    accessToken: null as string | null,
    loaded: false,
    isLocalSession: false,
    sessionCheckedAt: 0,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    isStaff: (state) => state.user?.role === 'ADMIN' || state.user?.role === 'SUPER_ADMIN',
    isSuperAdmin: (state) => state.user?.role === 'SUPER_ADMIN',
  },
  actions: {
    setUser(user: AuthUserDto | null, isLocalSession = false) {
      this.user = user;
      this.isLocalSession = isLocalSession;
      this.loaded = true;
      if (user) this.sessionCheckedAt = Date.now();
    },
    setTokens(accessToken: string | null, refreshToken?: string | null) {
      this.accessToken = accessToken;
      if (import.meta.client) {
        saveStoredTokens(accessToken, refreshToken);
      }
    },
    hydrateLocal() {
      if (!LOCAL_AUTH_ENABLED) return;
      const local = loadLocalSession();
      if (local && isStaffUser(local)) {
        this.setUser(local, true);
      }
    },
    hydrateTokens() {
      if (!import.meta.client) return;
      const { accessToken } = loadStoredTokens();
      this.accessToken = accessToken;
    },
    applySession(data: AuthSessionDto, isLocalSession = false) {
      clearLocalSession();
      if (data.accessToken) {
        this.setTokens(data.accessToken, data.refreshToken ?? null);
      }
      this.setUser(data.user, isLocalSession);
    },
    async refreshSession() {
      const baseUrl = useApiBaseUrl();
      const stored = loadStoredTokens();
      const body = stored.refreshToken ? { refreshToken: stored.refreshToken } : undefined;
      const data = await $fetch<AuthRefreshDto>(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        body,
        headers: authFetchHeaders(this.accessToken),
      });
      if (data.accessToken) {
        this.setTokens(data.accessToken, data.refreshToken ?? stored.refreshToken ?? null);
      }
    },
    async fetchMe(options: { allowRefresh?: boolean } = {}) {
      const { allowRefresh = true } = options;
      const baseUrl = useApiBaseUrl();
      const fetchOptions = {
        credentials: 'include' as const,
        headers: authFetchHeaders(this.accessToken),
      };

      try {
        const data = await $fetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, fetchOptions);
        if (isStaffUser(data.user)) {
          clearLocalSession();
          this.setUser(data.user, false);
        } else {
          this.setUser(null, false);
        }
        return;
      } catch {
        if (allowRefresh) {
          try {
            await this.refreshSession();
            const data = await $fetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, {
              credentials: 'include',
              headers: authFetchHeaders(this.accessToken),
            });
            if (isStaffUser(data.user)) {
              clearLocalSession();
              this.setUser(data.user, false);
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

        if (isStaffUser(this.user) && (this.accessToken || Date.now() - this.sessionCheckedAt < 30_000)) {
          return;
        }

        const hadStaffSession = isStaffUser(this.user);
        this.setUser(null, false);
        if (hadStaffSession) {
          this.setTokens(null, null);
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
      const data = await $fetch<AuthSessionDto>(`${baseUrl}/auth/mock-login`, {
        method: 'POST',
        body: { email, name },
        credentials: 'include',
      });
      this.applySession(data, false);
      return data.user;
    },
    async credentialLogin(email: string, password: string) {
      const baseUrl = useApiBaseUrl();
      const data = await $fetch<AuthSessionDto>(`${baseUrl}/auth/login`, {
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
      if (import.meta.client) {
        sessionStorage.removeItem(AUTH_REDIRECT_KEY);
      }
      const baseUrl = useApiBaseUrl();
      try {
        await $fetch(`${baseUrl}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: authFetchHeaders(this.accessToken),
        });
      } catch { /* */ }
      this.accessToken = null;
      this.setUser(null, false);
      this.loaded = false;
    },
  },
});
