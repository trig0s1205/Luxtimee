/** Evita navegaciones colgadas cuando el API tarda (cold start de Cloud Run). */
export const API_TIMEOUT_MS = 12_000;

/** La venta POS puede tardar más que el resto del panel; el reintento usa la misma clave. */
export const POS_SALE_TIMEOUT_MS = 30_000;

/** Sesión/refresh: más corto porque bloquea el cambio de módulo en el panel. */
export const AUTH_TIMEOUT_MS = 8_000;
