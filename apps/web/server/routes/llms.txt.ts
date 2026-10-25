import { CANONICAL_ORIGIN } from '../../utils/seo';
import { buildLlmsTxt } from '../utils/llms-build';
import { catalogBaseCandidates, resolveSitemapWatches } from '../utils/sitemap-build';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  let requestOrigin = '';
  try {
    requestOrigin = getRequestURL(event).origin;
  } catch {
    requestOrigin = '';
  }
  const watches = await resolveSitemapWatches({
    bases: catalogBaseCandidates({
      apiInternalUrl: String(config.apiInternalUrl || ''),
      publicApiBase: String(config.public.apiBaseUrl || ''),
      siteUrl: String(config.public.siteUrl || ''),
      requestOrigin,
    }),
    fetchPage: (url) => $fetch(url, { timeout: 8000 }),
    allowMockFallback: process.env.NUXT_SITEMAP_MOCK_FALLBACK === '0' ? false : undefined,
  });
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=300');
  return buildLlmsTxt(watches, CANONICAL_ORIGIN);
});
