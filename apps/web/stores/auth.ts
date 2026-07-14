import { defineStore } from 'pinia';
import type { AuthUserDto } from '@luxtime/shared';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUserDto | null,
    loaded: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    isStaff: (state) => state.user?.role === 'ADMIN' || state.user?.role === 'SUPER_ADMIN',
  },
  actions: {
    setUser(user: AuthUserDto | null) {
      this.user = user;
      this.loaded = true;
    },
    async fetchMe() {
      const config = useRuntimeConfig();
      try {
        const data = await $fetch<{ user: AuthUserDto }>(`${config.public.apiBaseUrl}/auth/me`, {
          credentials: 'include',
        });
        this.setUser(data.user);
      } catch {
        this.setUser(null);
      }
    },
    async mockLogin(email: string, name: string) {
      const config = useRuntimeConfig();
      const data = await $fetch<{ user: AuthUserDto }>(`${config.public.apiBaseUrl}/auth/mock-login`, {
        method: 'POST',
        body: { email, name },
        credentials: 'include',
      });
      this.setUser(data.user);
      return data.user;
    },
    async logout() {
      const config = useRuntimeConfig();
      await $fetch(`${config.public.apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      this.setUser(null);
    },
  },
});
