/** Evita navegaciones colgadas cuando el API tarda (cold start de Cloud Run). */
export const API_TIMEOUT_MS = 12_000;

/** Sesión/refresh: más corto porque bloquea el cambio de módulo en el panel. */
export const AUTH_TIMEOUT_MS = 8_000;
