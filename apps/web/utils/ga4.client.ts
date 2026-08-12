const CONSENT_KEY = 'LUXTIMEE-cookies';
export const GA4_CONSENT_EVENT = 'luxtimee:analytics-consent';

let scriptPromise: Promise<void> | null = null;

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

function ensureGtagStub() {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
}

function loadGtagScript(measurementId: string): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    ensureGtagStub();
    window.gtag!('js', new Date());

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`,
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.onload = () => {
      script.dataset.loaded = '1';
      resolve();
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('No se pudo cargar gtag.js'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function bootGa4(measurementId?: string | null, path?: string): Promise<boolean> {
  if (!import.meta.client || !measurementId?.trim() || !hasAnalyticsConsent()) return false;

  try {
    await loadGtagScript(measurementId);
    window.gtag!('config', measurementId, {
      page_path: path ?? `${window.location.pathname}${window.location.search}`,
      page_location: window.location.href,
      page_title: document.title,
    });
    return true;
  } catch {
    return false;
  }
}

export function trackGa4PageView(path: string, measurementId?: string | null) {
  void bootGa4(measurementId, path);
}

export function trackGa4Event(event: string, payload?: Record<string, unknown>) {
  if (!import.meta.client || !window.gtag || !hasAnalyticsConsent()) return;
  window.gtag('event', event, payload);
}

export function notifyAnalyticsConsent() {
  if (!import.meta.client) return;
  window.dispatchEvent(new CustomEvent(GA4_CONSENT_EVENT));
}
