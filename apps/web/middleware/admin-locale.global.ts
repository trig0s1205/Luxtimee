import { isAdminPanelRoute } from '~/utils/locale-routes';

export default defineNuxtRouteMiddleware((to) => {
  if (!isAdminPanelRoute(to.path)) return;
  if (import.meta.client) {
    document.documentElement.lang = 'es';
  }
});
