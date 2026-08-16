import { defineStore } from 'pinia';
import type { AuthRefreshDto, AuthSessionDto, AuthUserDto } from '@luxtime/shared';
import { Role } from '@luxtime/shared';
import {
  authFetchHeaders,
  clearStoredTokens,
  loadStoredTokens,
  loadStoredUser,
  resolveAccessToken,
  saveStoredTokens,
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
        if (accessToken) invalidateStaffAdminCaches();
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
      if (!this.user) {
        const storedUser = loadStoredUser<AuthUserDto>();
        if (storedUser && isStaffUser(storedUser)) {
          this.user = storedUser;
          this.loaded = true;
        }
      }
    },
    applySession(data: AuthSessionDto, isLocalSession = false) {
      clearLocalSession();
      if (data.accessToken) {
        this.setTokens(data.accessToken, data.refreshToken ?? null);
      }
      this.setUser(data.user, isLocalSession);
      if (import.meta.client && isStaffUser(data.user)) {
        saveStoredUser(data.user);
        invalidateStaffAdminCaches();
      }
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
    async ensureAccessToken(forceRefresh = false): Promise<string> {
      this.hydrateTokens();
      if (!forceRefresh) {
        const existing = resolveAccessToken(this.accessToken);
        if (existing) return existing;
      }
      await this.refreshSession();
      const token = resolveAccessToken(this.accessToken);
      if (!token) {
        throw new Error('Tu sesión expiró. Cierra sesión e ingresa de nuevo.');
      }
      return token;
    },
    async fetchMe(options: { allowRefresh?: boolean } = {}) {
      const { allowRefresh = true } = options;
      this.hydrateTokens();
      const baseUrl = useApiBaseUrl();
      const token = resolveAccessToken(this.accessToken);
      const fetchOptions = {
        credentials: 'include' as const,
        headers: authFetchHeaders(token),
      };

      try {
        const data = await $fetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, fetchOptions);
        if (isStaffUser(data.user)) {
          clearLocalSession();
          this.setUser(data.user, false);
          if (import.meta.client) saveStoredUser(data.user);
          if (!resolveAccessToken(this.accessToken)) {
            try {
              await this.refreshSession();
            } catch { /* cookies siguen valiendo para /api/v1 */ }
          }
        } else {
          this.setUser(null, false);
          if (import.meta.client) saveStoredUser(null);
        }
        return;
      } catch {
        if (allowRefresh) {
          try {
            await this.refreshSession();
            const data = await $fetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, {
              credentials: 'include',
              headers: authFetchHeaders(resolveAccessToken(this.accessToken)),
            });
            if (isStaffUser(data.user)) {
              clearLocalSession();
              this.setUser(data.user, false);
              if (import.meta.client) saveStoredUser(data.user);
              if (!resolveAccessToken(this.accessToken)) {
                try {
                  await this.refreshSession();
                } catch { /* cookies siguen valiendo para /api/v1 */ }
              }
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

        if (isStaffUser(this.user) && (resolveAccessToken(this.accessToken) || Date.now() - this.sessionCheckedAt < 30_000)) {
          return;
        }

        const hadStaffSession = isStaffUser(this.user);
        this.setUser(null, false);
        if (hadStaffSession) {
          this.setTokens(null, null);
          if (import.meta.client) saveStoredUser(null);
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
      if (!resolveAccessToken(this.accessToken)) {
        try {
          await this.refreshSession();
        } catch { /* cookies pueden bastar */ }
      }
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
      if (import.meta.client) invalidateStaffAdminCaches();
    },
  },
});
