/** Normaliza texto para comparar saludos/marca sin tildes, mayúsculas ni adornos. */
export function normalizeWhatsappLead(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[*_~`]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}✨⭐️]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const GREETING_RE = /^(hola|buenas|buen(?:os|as)?(?:\s+dias?)?)\b/;

/**
 * True si el mensaje ya trae saludo o la marca al inicio (no hay que anteponer el prefijo del admin).
 */
export function whatsappMessageHasLeadIn(
  message: string,
  prefix?: string | null,
): boolean {
  const msg = normalizeWhatsappLead(message);
  if (!msg) return false;

  const pre = normalizeWhatsappLead(prefix ?? '');
  if (pre && (msg === pre || msg.startsWith(`${pre} `) || msg.startsWith(pre))) {
    return true;
  }

  if (GREETING_RE.test(msg)) return true;
  if (msg.startsWith('luxtimee')) return true;
  return false;
}

/**
 * Une prefijo de admin + mensaje sin duplicar saludo/marca.
 * Si el mensaje ya empieza con Hola/Buenas/LUXTIMEE (o ya incluye el prefijo), se usa solo el mensaje.
 */
export function composeWhatsappText(
  prefix: string | null | undefined,
  message: string | null | undefined,
): string {
  const raw = message ?? '';
  const msg = raw.trim();
  const pre = (prefix ?? '').trim();
  if (!msg) return pre;
  // Conserva espacios finales del mensaje (p. ej. "Mi ciudad es ").
  const keepTrailing = raw.replace(/^\s+/, '');
  if (!pre) return keepTrailing;
  if (whatsappMessageHasLeadIn(msg, pre)) return keepTrailing;
  return `${pre} ${msg}`.replace(/\s+/g, ' ').trim();
}
