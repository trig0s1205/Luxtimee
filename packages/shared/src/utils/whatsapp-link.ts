/** Teléfono internacional (solo dígitos) a partir de un número o de un enlace de WhatsApp. */
export function whatsappPhoneFromInput(raw: string | null | undefined): string | null {
  const source = (raw ?? '').trim();
  if (!source) return null;

  let digits = '';
  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      if (url.hostname.includes('wa.me')) {
        digits = url.pathname.replace(/\D/g, '');
      } else if (url.hostname.includes('whatsapp.com')) {
        digits = (url.searchParams.get('phone') ?? '').replace(/\D/g, '');
      }
    } catch {
      digits = '';
    }
  } else {
    digits = source.replace(/\D/g, '');
  }

  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('3')) digits = `57${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

export function whatsappUrlFromInput(raw: string | null | undefined): string | null {
  const phone = whatsappPhoneFromInput(raw);
  if (!phone) return null;
  return `https://wa.me/${phone}`;
}
