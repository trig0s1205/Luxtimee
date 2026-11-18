import { isLocalSellerRoute } from '~/utils/local-seller-routes';

/** Ventana en la que la sesión se considera verificada y no se revalida. */
const SESSION_FRESH_MS = 30_000;

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  auth.hydrateLocal();
  auth.hydrateStoredStaff();
  auth.hydrateTokens();

  const freshPanelSession = auth.canUsePanel && Date.now() - auth.sessionCheckedAt < SESSION_FRESH_MS;

  if (!freshPanelSession) {
    await auth.fetchMe({ allowRefresh: true });
  }

  // Tras un fallo de red fetchMe conserva al staff; solo redirigir si no hay usuario.
  if (!auth.user || !auth.canUsePanel) {
    return navigateTo('/vigilancia', { replace: true });
  }

  if (auth.isLocalSeller && !isLocalSellerRoute(to.path)) {
    return navigateTo('/admin/pos', { replace: true });
  }
});
