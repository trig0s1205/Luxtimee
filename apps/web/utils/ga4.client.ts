const CONSENT_KEY = 'LUXTIMEE-cookies';

let loaded = false;
let loading = false;

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

function flushQueuedPageView(measurementId: string, path?: string) {
  window.gtag?.('event', 'page_view', {
    page_path: path ?? window.location.pathname + window.location.search,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function initGa4(measurementId?: string | null, path?: string): boolean {
  if (!import.meta.client || !measurementId?.trim()) return false;
  if (!hasAnalyticsConsent()) return false;
  if (loaded) {
    if (path) flushQueuedPageView(measurementId, path);
    return true;
  }
  if (loading) return false;

  loading = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.onload = () => {
    loaded = true;
    loading = false;
    flushQueuedPageView(measurementId, path);
  };
  script.onerror = () => {
    loaded = false;
    loading = false;
  };
  document.head.appendChild(script);

  return true;
}

export function trackGa4PageView(path: string, measurementId?: string | null) {
  if (!import.meta.client || !measurementId?.trim()) return;
  initGa4(measurementId, path);
}

export function trackGa4Event(event: string, payload?: Record<string, unknown>) {
  if (!import.meta.client || !window.gtag) return;
  window.gtag('event', event, payload);
}
