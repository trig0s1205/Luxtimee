import type { HomepageConfigDto } from '@luxtime/shared';

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfigDto = {
  hero: {
    enabled: true,
    eyebrow: 'Relojes de lujo · Piedecuesta',
    title: 'Piezas con presencia. Stock real en Colombia.',
    subtitle: 'Curaduría · Entrega · Garantía',
    ctaText: 'Ver colección',
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

export function useHomepageConfig() {
  const baseUrl = useApiBaseUrl();

  async function fetchConfig(): Promise<HomepageConfigDto> {
    try {
      return await $fetch<HomepageConfigDto>(`${baseUrl}/settings/homepage/public`);
    } catch {
      return structuredClone(DEFAULT_HOMEPAGE_CONFIG);
    }
  }

  return { fetchConfig, DEFAULT_HOMEPAGE_CONFIG };
}
