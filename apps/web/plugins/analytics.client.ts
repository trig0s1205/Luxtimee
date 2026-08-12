import {
  GA4_CONSENT_EVENT,
  readAnalyticsConsent,
  trackGa4PageView,
} from '~/utils/ga4.client';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const measurementId = String(config.public.ga4MeasurementId ?? '').trim();
  if (!measurementId) return;

  const router = useRouter();
  const consent = useState('ga4-consent', () => readAnalyticsConsent());

  useHead(() => {
    if (!consent.value) return {};
    return {
      script: [
        {
          key: 'ga4-inline',
          type: 'text/javascript',
          innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');`,
        },
        {
          key: 'ga4-src',
          src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`,
          async: true,
        },
      ],
    };
  });

  router.afterEach((to) => {
    trackGa4PageView(measurementId, to.fullPath);
  });

  window.addEventListener(GA4_CONSENT_EVENT, () => {
    consent.value = true;
    trackGa4PageView(measurementId, router.currentRoute.value.fullPath);
  });
});
