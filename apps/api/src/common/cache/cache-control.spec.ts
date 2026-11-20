import { cacheControlHeader } from './response-cache.interceptor';

describe('cacheControlHeader', () => {
  it('usa private, no-store cuando el stock no debe cachearse en el navegador', () => {
    expect(
      cacheControlHeader({ ttlMs: 60_000, tag: 'catalog', privateNoStore: true, maxAge: 60 }),
    ).toBe('private, no-store');
  });

  it('mantiene caché pública para el sitemap', () => {
    expect(
      cacheControlHeader({ ttlMs: 60_000, tag: 'catalog', maxAge: 300 }),
    ).toBe('public, max-age=300, stale-while-revalidate=30');
  });
});
