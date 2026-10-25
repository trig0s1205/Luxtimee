import { buildSitemapEntries, buildSitemapXml, catalogBaseCandidates, resolveSitemapWatches } from '../utils/sitemap-build';
import { CANONICAL_ORIGIN } from '../../utils/seo';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  let requestOrigin = '';
  try {
    requestOrigin = getRequestURL(event).origin;
  } catch {
    requestOrigin = '';
  }
  const bases = catalogBaseCandidates({
    apiInternalUrl: String(config.apiInternalUrl || ''),
    publicApiBase: String(config.public.apiBaseUrl || ''),
    siteUrl: String(config.public.siteUrl || ''),
    requestOrigin,
  });
  const watches = await resolveSitemapWatches({
    bases,
    fetchPage: (url) => $fetch(url, { timeout: 8000 }),
    allowMockFallback: process.env.NUXT_SITEMAP_MOCK_FALLBACK === '1'
      ? true
      : process.env.NUXT_SITEMAP_MOCK_FALLBACK === '0'
        ? false
        : undefined,
  });
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=300');
  return buildSitemapXml(buildSitemapEntries(watches, CANONICAL_ORIGIN));
});
