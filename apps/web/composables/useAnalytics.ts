import { trackGa4Event } from '~/utils/ga4.client';

export function useAnalytics() {
  const track = (event: string, payload?: Record<string, unknown>) => {
    if (!import.meta.client) return;
    if (import.meta.dev) {
      console.debug('[analytics]', event, payload);
    }
    trackGa4Event(event, payload);
  };

  return { track };
}
