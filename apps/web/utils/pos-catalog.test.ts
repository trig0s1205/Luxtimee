import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fallbackGallery,
  hasActiveCatalogFilters,
  photoInitials,
  safeCatalogItems,
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

  it('photoInitials y filtros activos', () => {
    assert.equal(photoInitials('Casio', 'G-Shock'), 'CG');
    assert.equal(hasActiveCatalogFilters(['', '', 'Negro']), true);
    assert.equal(hasActiveCatalogFilters(['', null, undefined]), false);
  });
});
