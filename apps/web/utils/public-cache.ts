/** Ventana máxima de frescura para páginas con catálogo, stock o precio. */
export const FRESH_SWR_SECONDS = 60;

/** Páginas de contenido que no muestran stock ni precio. */
export const STATIC_PAGE_SWR_SECONDS = 60 * 60;

export const LEGAL_PAGE_SWR_SECONDS = 24 * 60 * 60;

export const HASHED_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export const PUBLIC_IMAGE_CACHE_CONTROL = 'public, max-age=2592000, stale-while-revalidate=604800';

/** São Paulo: misma región que Cloud Run southamerica-east1. */
export const VERCEL_FUNCTION_REGIONS = ['gru1'] as const;
