import { hasAnalyticsConsent, initGa4, trackGa4PageView } from '~/utils/ga4.client';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const measurementId = config.public.ga4MeasurementId as string;
  const router = useRouter();

  if (hasAnalyticsConsent()) {
    initGa4(measurementId);
    trackGa4PageView(router.currentRoute.value.fullPath, measurementId);
  }

  router.afterEach((to) => {
    if (!hasAnalyticsConsent()) return;
    initGa4(measurementId);
    trackGa4PageView(to.fullPath, measurementId);
  });
});
