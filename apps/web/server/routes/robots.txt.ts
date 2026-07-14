export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  setHeader(event, 'Content-Type', 'text/plain');
  return `User-agent: *\nAllow: /\nSitemap: ${config.public.siteUrl}/sitemap.xml\n`;
});
