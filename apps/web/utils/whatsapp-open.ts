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

/** WhatsApp Web: chat listo para enviar, sin alert de abrir app nativa (desktop). */
export function buildWhatsAppWebLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const params = new URLSearchParams();
  params.set('phone', digits);
  if (text.trim()) params.set('text', text);
  return `https://web.whatsapp.com/send?${params.toString()}`;
}

/** Intent de Android: abre la app directo sin landing de api.whatsapp.com */
export function buildAndroidIntentLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(text);
  return `intent://send?phone=${digits}&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
}

/**
 * URL óptima según dispositivo:
 * - Android → intent nativo
 * - iOS / móvil → wa.me (universal link a la app)
 * - Desktop → web.whatsapp.com (sin popup "abrir aplicación")
 */
export function buildWhatsAppLaunchUrl(phone: string, text: string): string {
  if (isAndroidBrowser()) return buildAndroidIntentLink(phone, text);
  if (isMobileBrowser()) return buildWaMeLink(phone, text);
  return buildWhatsAppWebLink(phone, text);
}

export function resolveWhatsAppLaunchUrl(webUrl: string): string {
  const data = parseWhatsAppUrl(webUrl);
  if (!data) return webUrl;
  return buildWhatsAppLaunchUrl(data.phone, data.text);
}

/**
 * Redirige al checkout de WhatsApp en la misma pestaña, justo tras el click de comprar.
 * Debe llamarse en la misma cadena del gesto del usuario (submit).
 */
export function launchWhatsAppCheckout(webUrl: string): boolean {
  if (!import.meta.client || !webUrl.trim()) return false;
  window.location.assign(resolveWhatsAppLaunchUrl(webUrl));
  return true;
}

/** Botón flotante / contacto general */
export function openWhatsAppChat(webUrl: string): boolean {
  return launchWhatsAppCheckout(webUrl);
}

export function normalizeWhatsAppWebUrl(webUrl: string): string {
  const data = parseWhatsAppUrl(webUrl);
  if (!data) return webUrl;
  return buildWaMeLink(data.phone, data.text);
}
