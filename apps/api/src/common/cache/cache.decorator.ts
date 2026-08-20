import { SetMetadata } from '@nestjs/common';

export const CACHEABLE_KEY = 'cacheable';

export interface CacheableOptions {
  /** TTL en milisegundos para la cache en memoria del servidor. */
  ttlMs: number;
  /** Etiqueta para invalidación cuando cambian datos relacionados. */
  tag: string;
  /** Valor de `max-age` en segundos para el header Cache-Control. */
  maxAge?: number;
}

export const Cacheable = (options: CacheableOptions) => SetMetadata(CACHEABLE_KEY, options);

export const CACHE_TAGS = {
  catalog: 'catalog',
  brands: 'brands',
  categories: 'categories',
  mechanisms: 'mechanisms',
  settings: 'settings',
  shipping: 'shipping',
} as const;
