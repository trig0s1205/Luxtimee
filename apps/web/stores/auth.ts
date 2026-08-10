import { defineStore } from 'pinia';
import type { AuthUserDto } from '@luxtime/shared';
import { Role } from '@luxtime/shared';
import {
  clearLocalSession,
  loadLocalSession,
  LOCAL_AUTH_ENABLED,
  saveLocalSession,
  validateLocalLogin,
} from '~/utils/local-auth';
import { AUTH_REDIRECT_KEY } from '~/utils/auth-redirect';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUserDto | null,
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
    hydrateLocal() {
      if (!LOCAL_AUTH_ENABLED) return;
      const local = loadLocalSession();
      if (local && (local.role === Role.ADMIN || local.role === Role.SUPER_ADMIN)) {
        this.setUser(local, true);
      }
    },
    async fetchMe(options: { allowRefresh?: boolean } = {}) {
      const { allowRefresh = true } = options;
      const baseUrl = useApiBaseUrl();
      try {
        const data = await $fetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, {
          credentials: 'include',
        });
        if (data.user.role === Role.ADMIN || data.user.role === Role.SUPER_ADMIN) {
          clearLocalSession();
          this.setUser(data.user, false);
        } else {
          this.setUser(null, false);
        }
        return;
      } catch {
        if (allowRefresh) {
          try {
            await $fetch(`${baseUrl}/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
            });
            const data = await $fetch<{ user: AuthUserDto }>(`${baseUrl}/auth/me`, {
              credentials: 'include',
            });
            if (data.user.role === Role.ADMIN || data.user.role === Role.SUPER_ADMIN) {
              clearLocalSession();
              this.setUser(data.user, false);
              return;
            }
          } catch { /* refresh falló */ }
        }

        if (LOCAL_AUTH_ENABLED) {
          const local = loadLocalSession();
          if (local && (local.role === Role.ADMIN || local.role === Role.SUPER_ADMIN)) {
            this.setUser(local, true);
            return;
          }
        }
        this.setUser(null, false);
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
      const data = await $fetch<{ user: AuthUserDto }>(`${baseUrl}/auth/mock-login`, {
        method: 'POST',
        body: { email, name },
        credentials: 'include',
      });
      clearLocalSession();
      this.setUser(data.user, false);
      return data.user;
    },
    async credentialLogin(email: string, password: string) {
      const baseUrl = useApiBaseUrl();
      const data = await $fetch<{ user: AuthUserDto }>(`${baseUrl}/auth/login`, {
        method: 'POST',
        body: { email: email.trim(), password },
        credentials: 'include',
      });
      clearLocalSession();
      this.setUser(data.user, false);
      return data.user;
    },
    async logout() {
      clearLocalSession();
      if (import.meta.client) {
        sessionStorage.removeItem(AUTH_REDIRECT_KEY);
      }
      const baseUrl = useApiBaseUrl();
      try {
        await $fetch(`${baseUrl}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch { /* */ }
      this.setUser(null, false);
      this.loaded = false;
    },
  },
});
