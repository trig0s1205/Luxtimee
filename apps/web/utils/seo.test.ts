import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRobotsTxt,
  canonicalUrl,
  faqPageJsonLd,
  formatDocumentTitle,
  isNoIndexPath,
  localBusinessJsonLd,
  productJsonLd,
  publicSitemapPaths,
  serializeJsonLd,
  shouldEmitCanonical,
  splitSameAs,
  staticPageSeo,
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

test('títulos locales y landing en el sitemap estático', () => {
  assert.equal(staticPageSeo('/')?.title, 'Relojes de lujo en Bucaramanga y Piedecuesta | LUXTIMEE');
  assert.equal(staticPageSeo('/mayoristas')?.title, 'Relojes al por mayor en Colombia | LUXTIMEE Mayoristas');
  assert.equal(staticPageSeo('/catalogo')?.title, 'Catálogo de relojes de lujo en Colombia | LUXTIMEE');
  assert.equal(staticPageSeo('/relojeria-bucaramanga')?.title, 'Relojería en Bucaramanga y Piedecuesta | LUXTIMEE');
  assert.ok(publicSitemapPaths().includes('/relojeria-bucaramanga'));
});

test('LocalBusiness omite teléfono, horario y redes vacíos', () => {
  const empty = localBusinessJsonLd({});
  assert.equal('telephone' in empty, false);
  assert.equal('openingHours' in empty, false);
  assert.equal('sameAs' in empty, false);
  assert.equal('contactPoint' in empty, false);
  assert.equal((empty.address as { addressLocality: string }).addressLocality, 'Piedecuesta');
  assert.equal((empty.address as { addressRegion: string }).addressRegion, 'Santander');
  const filled = localBusinessJsonLd({
    phone: ' 3000000000 ',
    openingHours: 'Mo-Sa 10:00-19:00',
    sameAs: splitSameAs('https://www.instagram.com/luxtimee, no-es-url'),
    whatsapp: 'https://wa.me/573000000000',
  });
  assert.equal(filled.telephone, '3000000000');
  assert.equal(filled.openingHours, 'Mo-Sa 10:00-19:00');
  assert.deepEqual(filled.sameAs, ['https://www.instagram.com/luxtimee', 'https://wa.me/573000000000']);
});

test('FAQPage solo incluye preguntas con respuesta', () => {
  assert.equal(faqPageJsonLd([{ question: ' ', answer: 'x' }, { question: 'Q', answer: '' }]), null);
  const node = faqPageJsonLd([{ question: '¿Envían?', answer: 'Sí, a Colombia.' }]);
  const raw = serializeJsonLd(node);
  assert.equal(raw.includes('<'), false);
  const parsed = JSON.parse(raw) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
  assert.equal(parsed.mainEntity[0]?.name, '¿Envían?');
  assert.equal(parsed.mainEntity[0]?.acceptedAnswer.text, 'Sí, a Colombia.');
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
