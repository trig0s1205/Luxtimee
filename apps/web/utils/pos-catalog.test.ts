import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fallbackGallery,
  hasActiveCatalogFilters,
  photoInitials,
  catalogPageList,
  safeCatalogItems,
  whatsappPhoneCo,
  stockBadge,
  warrantyLabel,
} from './pos-catalog';

describe('pos-catalog helpers', () => {
  it('stockBadge distingue última unidad', () => {
    assert.equal(stockBadge(1), 'Última unidad');
    assert.equal(stockBadge(5), 'Quedan 5');
  });

  it('warrantyLabel usa singular y plural', () => {
    assert.equal(warrantyLabel(0), 'Sin garantía');
    assert.equal(warrantyLabel(1), '1 mes');
    assert.equal(warrantyLabel(12), '12 meses');
  });

  it('fallbackGallery prioriza gallery y cae a imageUrl', () => {
    assert.deepEqual(fallbackGallery(['a', 'b'], 'c'), ['a', 'b']);
    assert.deepEqual(fallbackGallery([], 'c'), ['c']);
    assert.deepEqual(fallbackGallery(null, null), []);
  });

  it('safeCatalogItems no rompe con respuestas mal formadas', () => {
    assert.deepEqual(safeCatalogItems({ items: [{ id: 1 }] }), [{ id: 1 }]);
    assert.deepEqual(safeCatalogItems({}), []);
    assert.deepEqual(safeCatalogItems(null), []);
    assert.deepEqual(safeCatalogItems({ items: 'x' }), []);
  });

  it('catalogPageList y teléfono de WhatsApp', () => {
    assert.deepEqual(catalogPageList(1, 3), [1, 2, 3]);
    assert.deepEqual(catalogPageList(5, 12)[0], 1);
    assert.equal(whatsappPhoneCo('300 123 4567'), '573001234567');
    assert.equal(whatsappPhoneCo(''), null);
  });

  it('photoInitials y filtros activos', () => {
    assert.equal(photoInitials('Casio', 'G-Shock'), 'CG');
    assert.equal(hasActiveCatalogFilters(['', '', 'Negro']), true);
    assert.equal(hasActiveCatalogFilters(['', null, undefined]), false);
  });
});
