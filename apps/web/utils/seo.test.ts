import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRobotsTxt,
  canonicalUrl,
  formatDocumentTitle,
  isNoIndexPath,
  productJsonLd,
  serializeJsonLd,
  shouldEmitCanonical,
} from './seo';

test('titleTemplate unifica la marca y no la duplica', () => {
  assert.equal(formatDocumentTitle(''), 'LUXTIMEE — Relojes de lujo');
  assert.equal(formatDocumentTitle('LuxTimee — Luxury Watches'), 'LUXTIMEE — Luxury Watches');
  assert.equal(formatDocumentTitle('Catálogo'), 'Catálogo — LUXTIMEE');
  assert.equal(formatDocumentTitle('Carrito — LUXTIMEE'), 'Carrito — LUXTIMEE');
});

test('canonical absoluto sin query', () => {
  assert.equal(canonicalUrl('/'), 'https://www.luxtimee.com/');
  assert.equal(canonicalUrl('/catalogo?search=rolex&page=2'), 'https://www.luxtimee.com/catalogo');
  assert.equal(canonicalUrl('/producto/rolex-submariner-date/'), 'https://www.luxtimee.com/producto/rolex-submariner-date');
});

test('noindex en zonas privadas y transaccionales', () => {
  assert.equal(isNoIndexPath('/carrito'), true);
  assert.equal(isNoIndexPath('/checkout'), true);
  assert.equal(isNoIndexPath('/admin/inventario'), true);
  assert.equal(isNoIndexPath('/acceso/dev-portal-lx9k2'), true);
  assert.equal(isNoIndexPath('/vigilancia'), true);
  assert.equal(isNoIndexPath('/catalogo'), false);
  assert.equal(shouldEmitCanonical('/acceso/secreto'), false);
  assert.equal(shouldEmitCanonical('/catalogo'), true);
});

test('robots permite rastreo general y apunta al sitemap', () => {
  const robots = buildRobotsTxt();
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/carrito/);
  assert.match(robots, /Disallow: \/checkout/);
  assert.doesNotMatch(robots, /GPTBot/);
  assert.match(robots, /Sitemap: https:\/\/www\.luxtimee\.com\/sitemap\.xml/);
});

test('JSON-LD de producto es válido y escapa HTML', () => {
  const node = productJsonLd({
    name: 'Rolex <Sub>',
    description: 'Pieza',
    sku: 'LUX-1',
    brand: 'Rolex',
    slug: 'rolex-sub',
    price: 18500000,
    availability: 'InStock',
    images: ['https://cdn.example/watch.jpg'],
  });
  const raw = serializeJsonLd(node);
  assert.equal(raw.includes('<'), false);
  const parsed = JSON.parse(raw) as { offers: { priceCurrency: string; price: string; availability: string }; sku: string; brand: { name: string } };
  assert.equal(parsed.sku, 'LUX-1');
  assert.equal(parsed.brand.name, 'Rolex');
  assert.equal(parsed.offers.priceCurrency, 'COP');
  assert.equal(parsed.offers.price, '18500000');
  assert.equal(parsed.offers.availability, 'https://schema.org/InStock');
});
