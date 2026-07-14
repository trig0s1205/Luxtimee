export function useAnalytics() {
  const track = (event: string, payload?: Record<string, unknown>) => {
    if (!import.meta.client) return;
    if (import.meta.dev) {
      console.debug('[analytics]', event, payload);
    }
    // GA4 client plugin se cableará en Fase 14
  };

  return { track };
}
