import type { HomepageConfigDto } from '@luxtime/shared';

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfigDto = {
  hero: {
    enabled: true,
    eyebrow: 'Luxury Timepieces · Colombia',
    title: 'Nuestros relojes hablan por sí solos.',
    subtitle: 'Elegance · Presence · Style',
    ctaText: 'Ver colección',
    ctaLink: '/catalogo',
    backgroundImageUrl: '',
  },
  featured: {
    enabled: true,
    label: 'Colección 2026',
    titleLead: 'Nuestros',
    titleEm: 'relojes',
    intro: 'Explora la selección completa: piezas con carácter, acabados premium y stock real listo para envío a todo Colombia.',
    ctaText: 'Ver catálogo completo',
    ctaLink: '/catalogo',
  },
  founder: {
    enabled: true,
    badge: 'Quién es Luxtime',
    title: 'Más que un reloj.',
    titleEm: 'Una declaración.',
    quote: '"Elegir un reloj es elegir quién eres."',
    storyParagraphs: [
      'En Luxtime creemos que el tiempo merece ser vivido con intensidad. Cada pieza que seleccionamos lleva consigo una historia, un propósito y una presencia que va más allá de la función.',
      'Desde Piedecuesta, Santander, curaduramos relojes para quienes no se conforman con lo ordinario. Personas que entienden que el estilo no se impone — se vive.',
    ],
    signatureName: 'Luxtime',
    signatureRole: 'Fundador · Piedecuesta, Santander — Colombia',
    signatureImageUrl: '',
    carouselImages: ['', '', '', '', ''],
  },
  valueProps: {
    enabled: true,
    label: 'Por qué elegirnos',
    title: 'La diferencia Luxtime',
    items: [
      { icon: '✦', title: 'Selección curada', description: 'Cada pieza pasa por un riguroso proceso de curaduría antes de llegar a ti.' },
      { icon: '✦', title: 'Asesoría directa', description: 'Atención personalizada por WhatsApp sin intermediarios, desde el primer mensaje.' },
      { icon: '✦', title: 'Stock real', description: 'Solo vendemos lo que tenemos disponible para entrega inmediata en Colombia.' },
    ],
  },
  statement: {
    enabled: true,
    text: 'Un reloj no solo mide el tiempo.',
    textEm: 'Demuestra quién eres.',
    sub: 'Luxtime · Luxury Timepieces · PTA · Colombia',
  },
  contact: {
    enabled: true,
    label: 'Contacto',
    title: 'Hablemos de tu próxima pieza.',
    titleEm: 'Asesoría personalizada.',
    body: 'Cuéntanos qué buscas, un modelo específico o un encargo a medida. Nuestro equipo te responde por WhatsApp con atención directa desde Piedecuesta.',
    ctaText: 'Escribir por WhatsApp',
    whatsappMessage: 'Hola Luxtime, me gustaría recibir asesoría sobre la colección.',
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
