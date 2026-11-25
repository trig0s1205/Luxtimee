import assert from 'node:assert/strict';
import test from 'node:test';
import { INVENTORY_PAGE_SIZE, loadInventoryCount, loadInventoryWindow, mergeInventoryPage } from './inventory-pagination';

function catalog(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `w-${index + 1}` }));
}

/** El listado real recorta `limit` a 200; la página sigue siendo válida. */
function listLikeApi(items: { id: string }[], page: number, limit: number) {
  const take = Math.max(1, Math.min(200, limit));
  const start = (page - 1) * take;
  return { data: items.slice(start, start + take), total: items.length };
}

test('cargar más pasa de 200 sin duplicar ni saltar filas', async () => {
  const items = catalog(281);
  const limits: number[] = [];
  const loaded = await loadInventoryWindow(20, async (page, limit) => {
    limits.push(limit);
    return listLikeApi(items, page, limit);
  });
  assert.equal(INVENTORY_PAGE_SIZE, 30);
  assert.ok(limits.every((limit) => limit === 30));
  assert.equal(loaded.stale, false);
  assert.equal(loaded.total, 281);
  assert.equal(loaded.data.length, 281);
  assert.deepEqual(loaded.data.map((item) => item.id), items.map((item) => item.id));
});

test('el límite acumulado 30 × páginas se queda clavado en 200', () => {
  const items = catalog(281);
  const first = listLikeApi(items, 1, 30 * 7);
  const again = listLikeApi(items, 1, 30 * 8);
  assert.equal(first.data.length, 200);
  assert.equal(again.data.length, 200);
  assert.equal(again.data[0]?.id, first.data[0]?.id);
});

test('recargar la ventana con páginas de 100 también pasa de 200', async () => {
  const items = catalog(281);
  const limits: number[] = [];
  const loaded = await loadInventoryCount(281, async (page, limit) => {
    limits.push(limit);
    return listLikeApi(items, page, limit);
  }, { pageSize: 100 });
  assert.deepEqual(limits, [100, 100, 100]);
  assert.equal(loaded.data.length, 281);
  assert.deepEqual(loaded.data.map((item) => item.id), items.map((item) => item.id));
});

test('cargar de 30 en 30 conserva el orden al cruzar 200', () => {
  const items = catalog(281);
  let shown: { id: string }[] = [];
  for (let page = 1; shown.length < items.length; page += 1) {
    const batch = listLikeApi(items, page, INVENTORY_PAGE_SIZE);
    shown = mergeInventoryPage(shown, batch.data);
    if (batch.data.length < INVENTORY_PAGE_SIZE) break;
  }
  assert.equal(shown.length, 281);
  assert.deepEqual(shown.map((item) => item.id), items.map((item) => item.id));
});

test('tras borrar, la ventana recargada no conserva la fila ni deja huecos', async () => {
  let items = catalog(249);
  const before = await loadInventoryWindow(7, async (page, limit) => listLikeApi(items, page, limit));
  assert.equal(before.data.length, 210);
  const removed = items[14]!.id;
  items = items.filter((item) => item.id !== removed);
  const after = await loadInventoryWindow(before.pagesFetched, async (page, limit) => listLikeApi(items, page, limit));
  assert.equal(after.data.some((item) => item.id === removed), false);
  assert.deepEqual(after.data.map((item) => item.id), items.slice(0, after.data.length).map((item) => item.id));
  assert.equal(after.total, 248);
});
