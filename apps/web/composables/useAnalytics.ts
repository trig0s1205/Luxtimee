import { bootGa4, trackGa4Event } from '~/utils/ga4.client';

export function useAnalytics() {
  const config = useRuntimeConfig();

  const track = async (event: string, payload?: Record<string, unknown>) => {
    if (!import.meta.client) return;
    if (import.meta.dev) {
      console.debug('[analytics]', event, payload);
    }
    await bootGa4(config.public.ga4MeasurementId as string);
    trackGa4Event(event, payload);
  };

  return { track };
}
