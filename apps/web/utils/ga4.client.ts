const CONSENT_KEY = 'LUXTIMEE-cookies';
export const GA4_CONSENT_EVENT = 'luxtimee:analytics-consent';

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

export function readAnalyticsConsent(): boolean {
  return hasAnalyticsConsent();
}

export function setAnalyticsConsent(): void {
  if (!import.meta.client) return;
  localStorage.setItem(CONSENT_KEY, '1');
}

export function trackGa4PageView(measurementId: string, path: string) {
  if (!import.meta.client || !measurementId || !hasAnalyticsConsent()) return;
  window.gtag?.('config', measurementId, { page_path: path });
}

export function trackGa4Event(event: string, payload?: Record<string, unknown>) {
  if (!import.meta.client || !hasAnalyticsConsent()) return;
  window.gtag?.('event', event, payload);
}

export function notifyAnalyticsConsent() {
  if (!import.meta.client) return;
  setAnalyticsConsent();
  window.dispatchEvent(new CustomEvent(GA4_CONSENT_EVENT));
}
