export const WHOLESALE_MIN_UNITS = 4;
export const DEPOSIT_PER_UNIT_COP = 10_000;
export const PRE_ORDER_RESPONSE_HOURS = 24;
export const GLOBAL_INVENTORY_LOW_THRESHOLD = 120;
export const PRE_ORDER_ALERT_HOURS = 1;
export const WHOLESALE_ACCESS_COOKIE = 'LUXTIMEE_wholesale_token';
export const DEFAULT_WHOLESALE_COOKIE_DAYS = 30;
export const MIN_WHOLESALE_COOKIE_DAYS = 1;
export const MAX_WHOLESALE_COOKIE_DAYS = 365;

export const WHOLESALE_BANNER =
  '¿Compras al por mayor? Solicita acceso en nuestra sección de socios mayoristas.';

/** Única zona cuyo costo de envío es siempre $0 y no se puede cambiar desde admin. */
export const FREE_SHIPPING_ZONE_NAME = 'Piedecuesta';

export function isAlwaysFreeShippingZone(name: string): boolean {
  return name.trim().toLowerCase() === FREE_SHIPPING_ZONE_NAME.toLowerCase();
}
