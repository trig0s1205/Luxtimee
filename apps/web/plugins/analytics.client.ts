import { bootGa4, GA4_CONSENT_EVENT, hasAnalyticsConsent, trackGa4PageView } from '~/utils/ga4.client';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const measurementId = config.public.ga4MeasurementId as string;
  const router = useRouter();

  function syncPage(path?: string) {
    if (!hasAnalyticsConsent()) return;
    void bootGa4(measurementId, path);
  }

  syncPage(router.currentRoute.value.fullPath);

  router.afterEach((to) => {
    trackGa4PageView(to.fullPath, measurementId);
  });

  window.addEventListener(GA4_CONSENT_EVENT, () => {
    syncPage(router.currentRoute.value.fullPath);
  });
});
