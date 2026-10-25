export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const path = getRequestURL(event).pathname;
    if (!path.startsWith('/admin')) return;
    html.head.push('<meta name="robots" content="noindex, nofollow">');
  });
});
