import type { PaginatedResponse, WatchPublicDto } from '@luxtime/shared';

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const siteUrl = config.public.siteUrl as string;
  const apiBase = config.apiInternalUrl as string;

  let watches: WatchPublicDto[] = [];
  try {
    const res = await $fetch<PaginatedResponse<WatchPublicDto>>(`${apiBase}/catalog`, { query: { limit: 100 } });
    watches = res.data;
  } catch {
    watches = [];
  }

  const staticRoutes = ['', '/catalogo', '/mayoristas', '/sorteos'];
  const urls = [
    ...staticRoutes.map((path) => `${siteUrl}${path}`),
    ...watches.map((w) => `${siteUrl}/producto/${w.slug}`),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join('\n')}
</urlset>`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
});
