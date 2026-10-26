import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSitemapEntries,
  buildSitemapXml,
  catalogBaseCandidates,
  normalizeApiBase,
  resolveSitemapWatches,
} from './sitemap-build';

test('normaliza la base de la API', () => {
  assert.equal(normalizeApiBase('https://api.example.run.app'), 'https://api.example.run.app/api/v1');
  assert.equal(normalizeApiBase('https://api.example.run.app/api/v1/'), 'https://api.example.run.app/api/v1');
  assert.equal(normalizeApiBase('http://127.0.0.1:3001/api'), 'http://127.0.0.1:3001/api/v1');
});

test('arma candidatos sin duplicar', () => {
  const bases = catalogBaseCandidates({
    apiInternalUrl: 'https://api.example.run.app',
    publicApiBase: '/api/v1',
    siteUrl: 'https://www.luxtimee.com',
    requestOrigin: 'https://www.luxtimee.com',
  });
  assert.deepEqual(bases, [
    'https://api.example.run.app/api/v1',
    'https://www.luxtimee.com/api/v1',
  ]);
});

test('sitemap incluye páginas públicas y productos con lastmod', async () => {
  const watches = await resolveSitemapWatches({
    bases: ['https://api.example/api/v1'],
    allowMockFallback: false,
    log: () => {},
    fetchPage: async (url) => {
      if (url.endsWith('/catalog/sitemap')) {
        return {
          data: [
            { slug: 'rolex-sub', updatedAt: '2026-03-02T10:00:00.000Z' },
            { slug: 'omega-speed', createdAt: '2026-01-05T00:00:00.000Z' },
          ],
        };
      }
      throw new Error('no usar el catálogo paginado');
    },
  });
  const xml = buildSitemapXml(buildSitemapEntries(watches));
  assert.match(xml, /https:\/\/www\.luxtimee\.com\/relojeria-bucaramanga/);
  assert.match(xml, /https:\/\/www\.luxtimee\.com\/catalogo/);
  assert.match(xml, /https:\/\/www\.luxtimee\.com\/politica-de-privacidad/);
  assert.match(xml, /https:\/\/www\.luxtimee\.com\/producto\/rolex-sub/);
  assert.match(xml, /<lastmod>2026-03-02<\/lastmod>/);
  assert.match(xml, /https:\/\/www\.luxtimee\.com\/producto\/omega-speed/);
});

test('si /catalog/sitemap falla, pagina el catálogo público', async () => {
  const watches = await resolveSitemapWatches({
    bases: ['https://api.example/api/v1'],
    allowMockFallback: false,
    log: () => {},
    fetchPage: async (url) => {
      if (url.endsWith('/catalog/sitemap')) throw new Error('404');
      if (url.includes('page=1')) {
        return { data: [{ slug: 'rolex-sub', updatedAt: '2026-04-01T00:00:00.000Z' }], total: 1 };
      }
      return { data: [], total: 1 };
    },
  });
  assert.equal(watches[0]?.slug, 'rolex-sub');
});

test('si la API local falla, usa el catálogo de respaldo y lo registra', async () => {
  const logs: string[] = [];
  const watches = await resolveSitemapWatches({
    bases: ['http://127.0.0.1:9/api/v1'],
    log: (message) => logs.push(message),
    fetchPage: async () => {
      throw new Error('ECONNREFUSED');
    },
  });
  assert.ok(watches.some((watch) => watch.slug === 'rolex-submariner-date'));
  assert.ok(logs.some((line) => line.includes('falló')));
});
