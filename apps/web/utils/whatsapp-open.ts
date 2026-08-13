export type ParsedWhatsAppLink = {
  phone: string;
  text: string;
};

export type WhatsAppLaunchResult = {
  /** Desktop: pestaña nueva abierta. Móvil: redirección en la misma pestaña. */
  launched: boolean;
  /** Desktop: el navegador bloqueó el popup. */
  blocked?: boolean;
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

export function buildWhatsAppWebLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const params = new URLSearchParams();
  params.set('phone', digits);
  if (text.trim()) params.set('text', text);
  return `https://web.whatsapp.com/send?${params.toString()}`;
}

export function buildAndroidIntentLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(text);
  return `intent://send?phone=${digits}&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
}

/** URL para móvil (app nativa). */
export function buildMobileLaunchUrl(phone: string, text: string): string {
  if (isAndroidBrowser()) return buildAndroidIntentLink(phone, text);
  return buildWaMeLink(phone, text);
}

/** URL para desktop (WhatsApp Web). */
export function buildDesktopLaunchUrl(phone: string, text: string): string {
  return buildWhatsAppWebLink(phone, text);
}

export function resolveWhatsAppLaunchUrl(webUrl: string): string {
  const data = parseWhatsAppUrl(webUrl);
  if (!data) return webUrl;
  if (isMobileBrowser()) return buildMobileLaunchUrl(data.phone, data.text);
  return buildDesktopLaunchUrl(data.phone, data.text);
}

/** Desktop: abre WhatsApp Web en pestaña nueva. */
export function openWhatsAppInNewTab(webUrl: string): WhatsAppLaunchResult {
  if (!import.meta.client || !webUrl.trim()) {
    return { launched: false, blocked: true };
  }

  const data = parseWhatsAppUrl(webUrl);
  const url = data
    ? buildDesktopLaunchUrl(data.phone, data.text)
    : webUrl;

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) return { launched: false, blocked: true };
  popup.opener = null;
  return { launched: true };
}

/**
 * Checkout post-compra:
 * - Móvil → misma pestaña (app WA)
 * - Desktop → pestaña nueva (web.whatsapp.com), la tienda queda abierta
 */
export function launchWhatsAppCheckout(webUrl: string): WhatsAppLaunchResult {
  if (!import.meta.client || !webUrl.trim()) {
    return { launched: false, blocked: true };
  }

  if (isMobileBrowser()) {
    const data = parseWhatsAppUrl(webUrl);
    const url = data
      ? buildMobileLaunchUrl(data.phone, data.text)
      : webUrl;
    window.location.assign(url);
    return { launched: true };
  }

  return openWhatsAppInNewTab(webUrl);
}

/** Botón flotante / contacto */
export function openWhatsAppChat(webUrl: string): WhatsAppLaunchResult {
  return launchWhatsAppCheckout(webUrl);
}

export function normalizeWhatsAppWebUrl(webUrl: string): string {
  const data = parseWhatsAppUrl(webUrl);
  if (!data) return webUrl;
  return buildWaMeLink(data.phone, data.text);
}
