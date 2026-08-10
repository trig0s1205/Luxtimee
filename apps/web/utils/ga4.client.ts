const CONSENT_KEY = 'LUXTIMEE-cookies';

let loaded = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function hasAnalyticsConsent(): boolean {
  if (!import.meta.client) return false;
  return localStorage.getItem(CONSENT_KEY) === '1';
}

export function initGa4(measurementId?: string | null): boolean {
  if (!import.meta.client || !measurementId?.trim() || loaded) return loaded;
  if (!hasAnalyticsConsent()) return false;

  loaded = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });

  return true;
}

export function trackGa4PageView(path: string, measurementId?: string | null) {
  if (!import.meta.client || !measurementId?.trim()) return;
  if (!loaded && !initGa4(measurementId)) return;
  window.gtag?.('event', 'page_view', { page_path: path });
}

export function trackGa4Event(event: string, payload?: Record<string, unknown>) {
  if (!import.meta.client || !window.gtag) return;
  window.gtag('event', event, payload);
}
