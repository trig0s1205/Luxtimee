import type { HomepageConfigDto, HomepageCustomerProofImage } from '@luxtime/shared';

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfigDto = {
  hero: {
    enabled: true,
    eyebrow: 'Relojes de lujo · Piedecuesta',
    title: 'Piezas con presencia. Stock real en Colombia.',
    subtitle: 'Curaduría · Entrega · Garantía',
    ctaText: 'Ver catálogo',
    ctaLink: '/catalogo',
    backgroundImageUrl: '',
  },
  featured: {
    enabled: true,
    label: 'Catálogo',
    titleLead: 'Lo que está',
    titleEm: 'disponible hoy',
    intro: 'Cada referencia publicada tiene stock confirmado. Precio visible, envío nacional y entrega local en horario acordado.',
    ctaText: 'Explorar catálogo',
    ctaLink: '/catalogo',
  },
  founder: {
    enabled: true,
    badge: 'Desde Santander',
    title: 'Vendemos relojes,',
    titleEm: 'no promesas.',
    quote: '"Un buen reloj se nota en la muñeca y en el trato."',
    storyParagraphs: [
      'LUXTIMEE nació en Piedecuesta para vender relojes con fotos reales, precios claros y entrega sin vueltas. Sin catálogo inflado ni piezas fantasma.',
      'Compras por la web, confirmas por WhatsApp y recibes con el empaque y la garantía que ves en cada ficha. Así de simple.',
    ],
    signatureName: 'LUXTIMEE',
    signatureRole: 'Piedecuesta, Santander — Colombia',
    signatureImageUrl: '',
    carouselImages: ['', '', '', '', ''],
  },
  valueProps: {
    enabled: false,
    label: 'Por qué elegirnos',
    title: 'La diferencia LUXTIMEE',
    items: [],
  },
  customerProof: {
    enabled: true,
    label: 'Entregas reales',
    title: 'Clientes que ya',
    titleEm: 'recibieron su pieza',
    subtitle: 'Fotos de entregas locales y envíos nacionales. Sin renders ni stock de banco de imágenes.',
    images: [],
  },
  statement: {
    enabled: true,
    text: 'El detalle está en la entrega,',
    textEm: 'no en el discurso.',
    sub: 'LUXTIMEE · Piedecuesta · Colombia',
  },
  contact: {
    enabled: true,
    label: 'WhatsApp directo',
    title: '¿Buscas un modelo',
    titleEm: 'en específico?',
    body: 'Escríbenos el reloj, tu ciudad y si prefieres envío nacional o entrega local. Te respondemos con disponibilidad y tiempos reales.',
    ctaText: 'Abrir chat',
    whatsappMessage: 'Hola LUXTIMEE, busco un reloj en particular. Mi ciudad es ',
  },
};

export function isFounderCarouselComplete(images?: Array<string | null | undefined>) {
  return (images ?? []).filter((url) => typeof url === 'string' && url.trim()).length === 5;
}

export function shouldShowFounderSection(
  founder: Pick<HomepageConfigDto['founder'], 'enabled' | 'carouselImages'>,
) {
  return normalizeFounderEnabled(founder.enabled, founder.carouselImages);
}

export function normalizeFounderEnabled(
  enabled: boolean | undefined,
  carouselImages?: Array<string | null | undefined>,
) {
  if (!isFounderCarouselComplete(carouselImages)) return false;
  return true;
}

export function normalizeCustomerProofImages(raw: unknown): HomepageCustomerProofImage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): HomepageCustomerProofImage | null => {
      if (typeof item === 'string') {
        const url = item.trim().replace(/^["']|["']$/g, '');
        return url ? { url } : null;
      }
      if (item && typeof item === 'object' && 'url' in item) {
        const url = String((item as { url: unknown }).url ?? '').trim().replace(/^["']|["']$/g, '');
        const captionRaw = (item as { caption?: unknown }).caption;
        const caption = typeof captionRaw === 'string' ? captionRaw.trim().replace(/^["']|["']$/g, '') : '';
        return url ? { url, ...(caption ? { caption } : {}) } : null;
      }
      return null;
    })
    .filter((item): item is HomepageCustomerProofImage => item !== null && /^https?:\/\//i.test(item.url));
}

export function mergeHomepageConfig(remote: Partial<HomepageConfigDto> | null | undefined): HomepageConfigDto {
  const base = structuredClone(DEFAULT_HOMEPAGE_CONFIG);
  if (!remote) return base;

  return {
    ...base,
    ...remote,
    hero: { ...base.hero, ...(remote.hero ?? {}) },
    featured: { ...base.featured, ...(remote.featured ?? {}) },
    founder: {
      ...base.founder,
      ...(remote.founder ?? {}),
      carouselImages: remote.founder?.carouselImages ?? base.founder.carouselImages,
      storyParagraphs: remote.founder?.storyParagraphs ?? base.founder.storyParagraphs,
      enabled: normalizeFounderEnabled(
        remote.founder?.enabled,
        remote.founder?.carouselImages ?? base.founder.carouselImages,
      ),
    },
    valueProps: {
      ...base.valueProps,
      ...(remote.valueProps ?? {}),
      items: remote.valueProps?.items ?? base.valueProps.items,
    },
    customerProof: {
      ...base.customerProof,
      ...(remote.customerProof ?? {}),
      images: normalizeCustomerProofImages(remote.customerProof?.images),
    },
    statement: { ...base.statement, ...(remote.statement ?? {}) },
    contact: { ...base.contact, ...(remote.contact ?? {}) },
  };
}
