import type { FaqItem, HomepageConfigDto, HomepageCustomerProofImage, HomepageFaqConfig } from '@luxtime/shared';

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
  faq: {
    enabled: true,
    label: 'Preguntas frecuentes',
    title: 'Resolvemos',
    titleEm: 'tus dudas',
    items: [
      {
        question: '¿Cómo compro un reloj en LUXTIMEE?',
        answer: 'Eliges el modelo en el catálogo, lo agregas al carrito y completas el checkout. Confirmamos disponibilidad y tiempos por WhatsApp antes de despachar.',
      },
      {
        question: '¿Hacen envíos a todo Colombia?',
        answer: 'Sí. Enviamos a nivel nacional con transportadora. En Piedecuesta y área metropolitana de Bucaramanga también ofrecemos entrega local coordinada.',
      },
      {
        question: '¿Cuánto tarda en llegar mi pedido?',
        answer: 'Los tiempos dependen de tu ciudad. Te confirmamos la fecha estimada al cerrar la compra. Los envíos nacionales suelen tardar entre 2 y 5 días hábiles.',
      },
      {
        question: '¿Qué métodos de pago aceptan?',
        answer: 'Transferencia bancaria, Nequi, Daviplata y otros medios acordados por WhatsApp. El pago se confirma antes del despacho.',
      },
      {
        question: '¿Los relojes tienen garantía?',
        answer: 'Cada pieza incluye garantía según la ficha del modelo. Cubre defectos de fabricación; el plazo se indica en la descripción del reloj.',
      },
      {
        question: '¿Puedo ver el reloj antes de comprarlo?',
        answer: 'Publicamos fotos y video reales de cada referencia. Si estás en Santander, podemos coordinar una cita para ver la pieza.',
      },
    ],
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

export function normalizeFaqItems(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): FaqItem | null => {
      if (!item || typeof item !== 'object') return null;
      const question = String((item as { question?: unknown }).question ?? '').trim();
      const answer = String((item as { answer?: unknown }).answer ?? '').trim();
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((item): item is FaqItem => item !== null);
}

type LegacyHomepageFaqSource = Partial<HomepageFaqConfig> & {
  text?: string;
  textEm?: string;
  sub?: string;
};

export function migrateHomepageFaqConfig(
  faq?: LegacyHomepageFaqSource | null,
  legacyStatement?: LegacyHomepageFaqSource | null,
): HomepageFaqConfig {
  const source = faq ?? legacyStatement ?? {};
  const items = normalizeFaqItems(source.items);

  return {
    enabled: source.enabled ?? true,
    label: source.label?.trim() || DEFAULT_HOMEPAGE_CONFIG.faq.label,
    title: source.title?.trim() || DEFAULT_HOMEPAGE_CONFIG.faq.title,
    titleEm: source.titleEm?.trim() || DEFAULT_HOMEPAGE_CONFIG.faq.titleEm,
    items: items.length ? items : DEFAULT_HOMEPAGE_CONFIG.faq.items,
  };
}

export function mergeHomepageConfig(remote: Partial<HomepageConfigDto> & { statement?: LegacyHomepageFaqSource } | null | undefined): HomepageConfigDto {
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
    faq: migrateHomepageFaqConfig(remote.faq, remote.statement),
    contact: { ...base.contact, ...(remote.contact ?? {}) },
  };
}
