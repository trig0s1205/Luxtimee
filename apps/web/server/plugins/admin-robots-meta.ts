const GENERIC_TITLES = new Set([
  '',
  'LUXTIMEE — Relojes de lujo',
  'Relojes de lujo en Bucaramanga y Piedecuesta | LUXTIMEE',
]);

const ROBOTS = '<meta name="robots" content="noindex, nofollow">';

function titleInner(tag: string) {
  return tag.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const path = getRequestURL(event).pathname;
    const isAdmin = path === '/admin' || path.startsWith('/admin/');
    const isAcceso = path === '/acceso' || path.startsWith('/acceso/');
    if (!isAdmin && !isAcceso) return;

    const fallback = isAdmin ? 'Administración — LUXTIMEE' : 'Acceso — LUXTIMEE';
    let hasRobots = false;
    let hasTitle = false;

    html.head = html.head.map((tag) => {
      if (typeof tag !== 'string') return tag;
      let next = tag;
      if (/<title\b/i.test(next)) {
        hasTitle = true;
        next = next.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, (full) => {
          const current = titleInner(full);
          if (isAdmin || GENERIC_TITLES.has(current)) return `<title>${fallback}</title>`;
          return full;
        });
      }
      if (/name=["']robots["']/i.test(next)) {
        hasRobots = true;
        next = next.replace(/<meta\b[^>]*name=["']robots["'][^>]*>/gi, ROBOTS);
      }
      return next;
    });

    if (!hasRobots) html.head.push(ROBOTS);
    if (!hasTitle) html.head.push(`<title>${fallback}</title>`);
  });
});
