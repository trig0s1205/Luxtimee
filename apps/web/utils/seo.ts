export const BRAND = 'LUXTIMEE';
export const CANONICAL_ORIGIN = 'https://www.luxtimee.com';
export const DEFAULT_TITLE = 'LUXTIMEE — Relojes de lujo';
export const DEFAULT_DESCRIPTION = 'Relojes de lujo con stock real en Colombia. Compra en línea y confirma tu pedido por WhatsApp.';
export const DEFAULT_OG_IMAGE_PATH = '/og-image.png';
export const DEFAULT_OG_IMAGE_ALT = 'LUXTIMEE — relojes de lujo en Colombia';

export type Breadcrumb = { name: string; path: string };

export type PageSeo = {
  title: string;
  description: string;
  breadcrumbs?: Breadcrumb[];
};

const PRIVATE_PREFIXES = [
  '/admin',
  '/acceso',
  '/vigilancia',
  '/carrito',
  '/checkout',
  '/mayoristas/carrito',
  '/mayoristas/checkout',
  '/mayoristas/acceso',
  '/mayoristas/catalogo',
];

export function formatDocumentTitle(title?: string | null) {
  const raw = (title ?? '').replace(/LuxTimee/g, BRAND).replace(/\s+/g, ' ').trim();
  if (!raw) return DEFAULT_TITLE;
  if (raw.includes(BRAND)) return raw;
  return `${raw} — ${BRAND}`;
}

export function canonicalPath(path: string) {
  const noHash = path.split('#')[0] ?? '/';
  const pathname = noHash.split('?')[0] || '/';
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (withSlash.length > 1) return withSlash.replace(/\/+$/, '');
  return '/';
}

export function canonicalUrl(path: string) {
  return `${CANONICAL_ORIGIN}${canonicalPath(path)}`;
}

export function absoluteAssetUrl(url?: string | null) {
  const value = url?.trim();
  if (!value) return `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `${CANONICAL_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
}

export function isNoIndexPath(path: string) {
  const clean = canonicalPath(path);
  return PRIVATE_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}

export function shouldEmitCanonical(path: string) {
  const clean = canonicalPath(path);
  if (clean.startsWith('/acceso')) return false;
  if (clean.startsWith('/admin')) return false;
  if (clean.startsWith('/vigilancia')) return false;
  if (clean.startsWith('/mayoristas/acceso')) return false;
  return true;
}

export const PAGE_SEO: Record<string, PageSeo> = {
  '/': {
    title: 'LUXTIMEE — Relojes de lujo',
    description: DEFAULT_DESCRIPTION,
  },
  '/catalogo': {
    title: 'Catálogo de relojes — LUXTIMEE',
    description: 'Explora el catálogo de relojes de lujo de LUXTIMEE. Filtra por marca, mecanismo y precio. Stock real en Colombia.',
    breadcrumbs: [
      { name: 'Inicio', path: '/' },
      { name: 'Catálogo', path: '/catalogo' },
    ],
  },
  '/carrito': {
    title: 'Carrito — LUXTIMEE',
    description: 'Revisa los relojes que elegiste antes de confirmar tu pedido con LUXTIMEE.',
    breadcrumbs: [
      { name: 'Inicio', path: '/' },
      { name: 'Carrito', path: '/carrito' },
    ],
  },
  '/checkout': {
    title: 'Checkout — LUXTIMEE',
    description: 'Completa tus datos de entrega y confirma la compra de tu reloj LUXTIMEE por WhatsApp.',
    breadcrumbs: [
      { name: 'Inicio', path: '/' },
      { name: 'Checkout', path: '/checkout' },
    ],
  },
  '/mayoristas': {
    title: 'Mayoristas — LUXTIMEE',
    description: 'Programa mayorista LUXTIMEE: precios exclusivos, pedido mínimo y acceso privado al catálogo.',
    breadcrumbs: [
      { name: 'Inicio', path: '/' },
      { name: 'Mayoristas', path: '/mayoristas' },
    ],
  },
  '/mayoristas/catalogo': {
    title: 'Catálogo mayorista — LUXTIMEE',
    description: 'Catálogo privado de precios mayoristas LUXTIMEE. Acceso solo con enlace autorizado.',
    breadcrumbs: [
      { name: 'Inicio', path: '/' },
      { name: 'Mayoristas', path: '/mayoristas' },
      { name: 'Catálogo', path: '/mayoristas/catalogo' },
    ],
  },
  '/mayoristas/carrito': {
    title: 'Carrito mayorista — LUXTIMEE',
    description: 'Revisa tu pedido mayorista LUXTIMEE antes de confirmarlo. Mínimo de cuatro unidades.',
  },
  '/mayoristas/checkout': {
    title: 'Checkout mayorista — LUXTIMEE',
    description: 'Confirma la entrega de tu pedido mayorista LUXTIMEE y cierra la compra por WhatsApp.',
  },
  '/sorteos': {
    title: 'Sorteos exclusivos — LUXTIMEE',
    description: 'Sorteos exclusivos LUXTIMEE para quienes adquieren una pieza. Registro por WhatsApp y reglas claras.',
    breadcrumbs: [
      { name: 'Inicio', path: '/' },
      { name: 'Sorteos', path: '/sorteos' },
    ],
  },
  '/politica-de-privacidad': {
    title: 'Política de privacidad — LUXTIMEE',
    description: 'Política de tratamiento de datos personales de LUXTIMEE. Ley 1581 de 2012 — Habeas Data Colombia.',
    breadcrumbs: [
      { name: 'Inicio', path: '/' },
      { name: 'Política de privacidad', path: '/politica-de-privacidad' },
    ],
  },
  '/terminos-y-condiciones': {
    title: 'Términos y condiciones — LUXTIMEE',
    description: 'Términos y condiciones de compra de relojes de lujo en LUXTIMEE. Envíos nacionales en Colombia.',
    breadcrumbs: [
      { name: 'Inicio', path: '/' },
      { name: 'Términos y condiciones', path: '/terminos-y-condiciones' },
    ],
  },
};

export function staticPageSeo(path: string) {
  return PAGE_SEO[canonicalPath(path)] ?? null;
}

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function organizationJsonLd() {
  return {
    '@type': 'Organization',
    '@id': `${CANONICAL_ORIGIN}/#organization`,
    name: BRAND,
    url: CANONICAL_ORIGIN,
    logo: `${CANONICAL_ORIGIN}/favicon.png`,
    image: absoluteAssetUrl(DEFAULT_OG_IMAGE_PATH),
    email: 'contacto@luxtimee.com',
    areaServed: 'CO',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Piedecuesta',
      addressRegion: 'Santander',
      addressCountry: 'CO',
    },
  };
}

export function websiteJsonLd() {
  return {
    '@type': 'WebSite',
    '@id': `${CANONICAL_ORIGIN}/#website`,
    name: BRAND,
    url: CANONICAL_ORIGIN,
    inLanguage: 'es-CO',
    publisher: { '@id': `${CANONICAL_ORIGIN}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${CANONICAL_ORIGIN}/catalogo?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(crumbs: Breadcrumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: canonicalUrl(crumb.path),
    })),
  };
}

export type ProductLdInput = {
  name: string;
  description: string;
  sku: string;
  brand: string;
  slug: string;
  price: number;
  currency?: string;
  availability: 'InStock' | 'OutOfStock';
  images: string[];
};

export function productJsonLd(input: ProductLdInput) {
  const url = canonicalUrl(`/producto/${input.slug}`);
  const images = input.images.map((image) => absoluteAssetUrl(image)).filter(Boolean);
  return {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: input.name,
    description: input.description,
    sku: input.sku,
    url,
    image: images,
    brand: { '@type': 'Brand', name: input.brand },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: input.currency ?? 'COP',
      price: String(input.price),
      availability: `https://schema.org/${input.availability}`,
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

export function jsonLdGraph(nodes: Record<string, unknown>[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}

export function buildRobotsTxt(origin = CANONICAL_ORIGIN) {
  const lines = [
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    '',
    `Sitemap: ${origin.replace(/\/$/, '')}/sitemap.xml`,
    '',
  ];
  return lines.join('\n');
}

const SITEMAP_PATHS = [
  '/',
  '/catalogo',
  '/mayoristas',
  '/sorteos',
  '/politica-de-privacidad',
  '/terminos-y-condiciones',
];

export function publicSitemapPaths() {
  return [...SITEMAP_PATHS];
}
