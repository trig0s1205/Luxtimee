export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const token = String(useRuntimeConfig(event).public.googleSiteVerification ?? '').trim();
    if (!token) return;

    const tag = `<meta name="google-site-verification" content="${token}">`;
    if (html.head.some((chunk) => chunk.includes('google-site-verification'))) return;
    html.head.unshift(tag);
  });
});
