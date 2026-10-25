import { CANONICAL_ORIGIN, PAGE_SEO, canonicalUrl } from '../../utils/seo';
import type { SitemapWatch } from './sitemap-build';

export function buildLlmsTxt(watches: SitemapWatch[], origin = CANONICAL_ORIGIN) {
  const pages = Object.entries(PAGE_SEO)
    .filter(([path]) => !path.startsWith('/carrito') && !path.startsWith('/checkout') && !path.startsWith('/mayoristas/'))
    .map(([path, seo]) => `- ${path === '/' ? `${origin}/` : `${origin}${path}`}: ${seo.description}`);
  const products = watches.slice(0, 200).map((watch) => {
    const slug = watch.slug.trim();
    return `- ${canonicalUrl(`/producto/${slug}`).replace(CANONICAL_ORIGIN, origin.replace(/\/$/, ''))}`;
  });
  return [
    '# LUXTIMEE',
    '',
    '> Relojería de lujo en Colombia (es-CO). Stock real, compra en línea y confirmación por WhatsApp. Sede en Piedecuesta, Santander.',
    '',
    '## Páginas públicas',
    ...pages,
    `- ${origin}/mayoristas: programa mayorista con acceso privado`,
    '',
    '## Catálogo',
    products.length ? products.join('\n') : '- El listado completo está en el sitemap.',
    '',
    '## Más contexto',
    `- Sitemap: ${origin}/sitemap.xml`,
    `- Detalle: ${origin}/llms-full.txt`,
    `- Robots: ${origin}/robots.txt`,
    '',
  ].join('\n');
}

export function buildLlmsFullTxt(watches: SitemapWatch[], origin = CANONICAL_ORIGIN) {
  const lines = [
    '# LUXTIMEE — contexto completo',
    '',
    'LUXTIMEE vende relojes de lujo con fotografías reales, precio en pesos colombianos (COP) y entrega nacional. El idioma del sitio es español (es-CO).',
    '',
    '## Cómo comprar',
    '1. Elige un modelo en el catálogo.',
    '2. Agrégalo al carrito.',
    '3. Completa el checkout con datos de entrega.',
    '4. Confirma disponibilidad y pago por WhatsApp antes del despacho.',
    '',
    '## Páginas que no deben indexarse',
    '- /admin, /acceso y /vigilancia son zonas internas.',
    '- /carrito y /checkout son transaccionales.',
    '- /mayoristas/catalogo, /mayoristas/carrito y /mayoristas/checkout requieren acceso privado.',
    '',
    '## Fichas de producto',
  ];
  for (const watch of watches) {
    lines.push(`- ${origin}/producto/${watch.slug.trim()}`);
  }
  if (!watches.length) lines.push('- Sin productos en este momento. Consulta el sitemap.');
  lines.push('', `Sitemap: ${origin}/sitemap.xml`, '');
  return lines.join('\n');
}
