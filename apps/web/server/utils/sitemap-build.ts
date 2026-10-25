import { mockWatches } from '../../mocks/watches';
import { CANONICAL_ORIGIN, canonicalUrl, publicSitemapPaths } from '../../utils/seo';

export type SitemapWatch = {
  slug: string;
  updatedAt?: string | null;
  createdAt?: string | null;
};

export type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

type CatalogPage = {
  data?: SitemapWatch[];
  total?: number;
};

export type FetchLike = (url: string) => Promise<CatalogPage>;

export function normalizeApiBase(raw: string) {
  const base = raw.trim().replace(/\/$/, '');
  if (!base) return '';
  if (/\/api\/v\d+$/i.test(base)) return base;
  if (/\/api$/i.test(base)) return `${base}/v1`;
  return `${base}/api/v1`;
}

export function catalogBaseCandidates(input: {
  apiInternalUrl?: string;
  publicApiBase?: string;
  siteUrl?: string;
  requestOrigin?: string;
}) {
  const out: string[] = [];
  const push = (value?: string) => {
    if (!value?.trim()) return;
    const next = normalizeApiBase(value);
    if (next && !out.includes(next)) out.push(next);
  };
  push(input.apiInternalUrl);
  if (input.publicApiBase?.startsWith('http')) push(input.publicApiBase);
  if (input.publicApiBase?.startsWith('/') && input.siteUrl) push(`${input.siteUrl.replace(/\/$/, '')}${input.publicApiBase}`);
  if (input.requestOrigin) push(`${input.requestOrigin.replace(/\/$/, '')}/api/v1`);
  return out;
}

export function isLocalApiBase(base: string) {
  return /localhost|127\.0\.0\.1/i.test(base);
}

export function mockSitemapWatches(): SitemapWatch[] {
  return mockWatches
    .filter((watch) => watch.stock > 0 && watch.slug)
    .map((watch) => ({ slug: watch.slug, createdAt: '2026-01-01T00:00:00.000Z' }));
}

export function lastmodFromWatch(watch: SitemapWatch) {
  const raw = watch.updatedAt || watch.createdAt;
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSitemapEntries(watches: SitemapWatch[], origin = CANONICAL_ORIGIN) {
  const staticEntries: SitemapEntry[] = publicSitemapPaths().map((path) => ({
    loc: path === '/' ? `${origin}/` : `${origin}${path}`,
  }));
  const seen = new Set(staticEntries.map((entry) => entry.loc));
  const products: SitemapEntry[] = [];
  for (const watch of watches) {
    const slug = watch.slug?.trim();
    if (!slug) continue;
    const loc = canonicalUrl(`/producto/${slug}`).replace(CANONICAL_ORIGIN, origin.replace(/\/$/, ''));
    if (seen.has(loc)) continue;
    seen.add(loc);
    products.push({ loc, lastmod: lastmodFromWatch(watch) });
  }
  return [...staticEntries, ...products];
}

export function buildSitemapXml(entries: SitemapEntry[]) {
  const body = entries.map((entry) => {
    const lastmod = entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : '';
    return `  <url>\n    <loc>${xmlEscape(entry.loc)}</loc>${lastmod}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function readWatchList(payload: unknown): SitemapWatch[] | null {
  if (Array.isArray(payload)) return payload as SitemapWatch[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as CatalogPage).data)) {
    return (payload as CatalogPage).data ?? [];
  }
  return null;
}

async function fetchPaginatedCatalog(base: string, fetchPage: FetchLike) {
  const watches: SitemapWatch[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (watches.length < total && page <= 100) {
    const url = `${base}/catalog?limit=200&page=${page}`;
    const res = await fetchPage(url);
    const batch = readWatchList(res);
    if (!batch) throw new Error('respuesta de catálogo inválida');
    watches.push(...batch);
    total = res && typeof res.total === 'number' ? res.total : watches.length;
    if (!batch.length) break;
    page += 1;
  }
  return watches;
}

export async function fetchPublishedWatches(bases: string[], fetchPage: FetchLike, log: (message: string, extra?: unknown) => void) {
  let lastError: unknown;
  for (const base of bases) {
    const sitemapUrl = `${base}/catalog/sitemap`;
    try {
      const listed = readWatchList(await fetchPage(sitemapUrl));
      if (!listed) throw new Error('respuesta de sitemap inválida');
      log(`[sitemap] ${listed.length} productos desde ${sitemapUrl}`);
      return { watches: listed, source: sitemapUrl };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      log(`[sitemap] falló ${sitemapUrl}`, message);
    }

    try {
      const watches = await fetchPaginatedCatalog(base, fetchPage);
      log(`[sitemap] catálogo cargado desde ${base}: ${watches.length} productos`);
      return { watches, source: base };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      log(`[sitemap] falló ${base}/catalog`, message);
    }
  }
  return { watches: [] as SitemapWatch[], source: '', error: lastError };
}

export async function resolveSitemapWatches(input: {
  bases: string[];
  fetchPage: FetchLike;
  log?: (message: string, extra?: unknown) => void;
  allowMockFallback?: boolean;
}) {
  const log = input.log ?? ((message, extra) => console.error(message, extra ?? ''));
  const result = await fetchPublishedWatches(input.bases, input.fetchPage, log);
  if (result.watches.length || result.source) return result.watches;
  const local = input.bases.length === 0 || input.bases.every((base) => isLocalApiBase(base));
  if (input.allowMockFallback ?? local) {
    log('[sitemap] API no disponible; se usa el catálogo de respaldo local');
    return mockSitemapWatches();
  }
  log('[sitemap] no se pudo armar el catálogo; el sitemap queda solo con páginas públicas');
  return [];
}
