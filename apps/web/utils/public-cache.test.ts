import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRESH_SWR_SECONDS,
  HASHED_ASSET_CACHE_CONTROL,
  LEGAL_PAGE_SWR_SECONDS,
  PUBLIC_IMAGE_CACHE_CONTROL,
  STATIC_PAGE_SWR_SECONDS,
  VERCEL_FUNCTION_REGIONS,
} from './public-cache';
import { STOREFRONT_CACHE_MS } from './storefront-cache';

test('catálogo y ficha no superan la ventana SWR', () => {
  assert.equal(FRESH_SWR_SECONDS, 60);
  assert.ok(STOREFRONT_CACHE_MS.catalog <= FRESH_SWR_SECONDS * 1000);
  assert.ok(STOREFRONT_CACHE_MS.product <= FRESH_SWR_SECONDS * 1000);
});

test('el resto del storefront puede cachearse más tiempo', () => {
  assert.ok(STOREFRONT_CACHE_MS.homepage > FRESH_SWR_SECONDS * 1000);
  assert.ok(STOREFRONT_CACHE_MS.static > STOREFRONT_CACHE_MS.catalog);
  assert.ok(STATIC_PAGE_SWR_SECONDS > FRESH_SWR_SECONDS);
  assert.ok(LEGAL_PAGE_SWR_SECONDS > STATIC_PAGE_SWR_SECONDS);
});

test('assets estáticos e imágenes tienen cache larga', () => {
  assert.match(HASHED_ASSET_CACHE_CONTROL, /immutable/);
  assert.match(HASHED_ASSET_CACHE_CONTROL, /max-age=31536000/);
  assert.match(PUBLIC_IMAGE_CACHE_CONTROL, /max-age=2592000/);
});

test('las funciones de Vercel quedan en gru1', () => {
  assert.deepEqual([...VERCEL_FUNCTION_REGIONS], ['gru1']);
});
