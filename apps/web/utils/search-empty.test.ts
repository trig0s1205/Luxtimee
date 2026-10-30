import assert from 'node:assert/strict';
import test from 'node:test';
import { searchEmptyMessage } from './search-empty';

test('avisa debajo de la búsqueda solo cuando no hay resultados', () => {
  assert.equal(
    searchEmptyMessage({
      term: 'RM-489',
      pending: false,
      count: 0,
      message: 'No se encontraron pedidos',
    }),
    'No se encontraron pedidos',
  );
  assert.equal(
    searchEmptyMessage({
      term: 'R',
      pending: false,
      count: 0,
      message: 'No se encontraron pedidos',
      minLength: 2,
    }),
    '',
  );
  assert.equal(
    searchEmptyMessage({
      term: 'RM-489',
      pending: true,
      count: 0,
      message: 'No se encontraron pedidos',
    }),
    '',
  );
  assert.equal(
    searchEmptyMessage({
      term: 'RM-489',
      pending: false,
      count: 1,
      message: 'No se encontraron pedidos',
    }),
    '',
  );
});
