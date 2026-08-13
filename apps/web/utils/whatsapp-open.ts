export type ParsedWhatsAppLink = {
  phone: string;
  text: string;
};

function isAndroidBrowser() {
  if (!import.meta.client) return false;
  return /Android/i.test(navigator.userAgent);
}

/** Extrae teléfono y mensaje desde wa.me, web.whatsapp.com o api.whatsapp.com */
export function parseWhatsAppUrl(url: string): ParsedWhatsAppLink | null {
  try {
    const parsed = new URL(url);
    let phone = '';
    let text = '';

    if (parsed.hostname.includes('wa.me')) {
      phone = parsed.pathname.replace(/\D/g, '');
      text = parsed.searchParams.get('text') ?? '';
    } else if (parsed.hostname.includes('whatsapp.com')) {
      phone = (parsed.searchParams.get('phone') ?? '').replace(/\D/g, '');
      text = parsed.searchParams.get('text') ?? '';
    } else {
      return null;
    }

    if (!phone) return null;
    return { phone, text: decodeURIComponent(text) };
  } catch {
    return null;
  }
}

export function buildWaMeLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const query = text.trim() ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}

export function buildAndroidIntentLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(text);
  return `intent://send?phone=${digits}&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
}

/** Enlace wa.me — abre la app en el celular con el mensaje precargado. */
export function buildMobileHandoffUrl(webUrl: string): string {
  const data = parseWhatsAppUrl(webUrl);
  if (!data) return webUrl;
  return buildWaMeLink(data.phone, data.text);
}

/**
 * Checkout móvil: redirige a la app de WhatsApp.
 * Desktop: no redirige (la UI muestra QR / enlace).
 */
export function launchWhatsAppCheckout(webUrl: string): boolean {
  if (!import.meta.client || !webUrl.trim() || !isMobileBrowser()) return false;

  const data = parseWhatsAppUrl(webUrl);
  const url = isAndroidBrowser() && data
    ? buildAndroidIntentLink(data.phone, data.text)
    : buildMobileHandoffUrl(webUrl);

  window.location.assign(url);
  return true;
}

/** WhatsApp Desktop instalado en PC (opcional). */
export function openWhatsAppDesktopApp(webUrl: string): void {
  if (!import.meta.client || !webUrl.trim()) return;

  const data = parseWhatsAppUrl(webUrl);
  if (!data) {
    window.location.assign(webUrl);
    return;
  }

  const params = new URLSearchParams();
  params.set('phone', data.phone.replace(/\D/g, ''));
  if (data.text.trim()) params.set('text', data.text);
  window.location.assign(`whatsapp://send?${params.toString()}`);
}

/** Botón flotante — móvil: app; PC: wa.me en pestaña nueva. */
export function openWhatsAppChat(webUrl: string): void {
  if (!import.meta.client || !webUrl.trim()) return;

  if (isMobileBrowser()) {
    launchWhatsAppCheckout(webUrl);
    return;
  }

  window.open(buildMobileHandoffUrl(webUrl), '_blank', 'noopener,noreferrer');
}

export function normalizeWhatsAppWebUrl(webUrl: string): string {
  return buildMobileHandoffUrl(webUrl);
}
