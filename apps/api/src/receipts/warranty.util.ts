import {
  bogotaDateParts,
  bogotaDateTimeUtc,
  bogotaDayRange,
  todayBogotaYmd,
} from './bogota-time.util';

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Suma meses a la fecha calendario de start en Bogotá; fin del día 23:59:59.999 Bogotá. */
export function addMonthsBogota(start: Date, months: number): Date {
  const parts = bogotaDateParts(start);
  const totalMonths = parts.month - 1 + months;
  const year = parts.year + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12; // 0-11
  const maxDay = daysInMonth(year, month + 1);
  const day = Math.min(parts.day, maxDay);
  return bogotaDateTimeUtc({ year, month: month + 1, day }, 23, 59, 59, 999);
}

export function computeWarrantyEnd(saleDate: Date, months: number): Date | null {
  if (!Number.isFinite(months) || months <= 0) return null;
  return addMonthsBogota(saleDate, months);
}

function calendarDayIndex(ymd: string): number {
  const { start } = bogotaDayRange(ymd);
  return Math.floor(start.getTime() / (24 * 60 * 60 * 1000));
}

export function warrantyStatus(
  endsAt: Date | null,
  now = new Date(),
): {
  state: 'SIN_GARANTIA' | 'VIGENTE' | 'VENCIDA';
  daysLeft: number | null;
} {
  if (!endsAt) {
    return { state: 'SIN_GARANTIA', daysLeft: null };
  }
  const todayYmd = todayBogotaYmd(now);
  const endYmd = todayBogotaYmd(endsAt);
  const daysLeft = calendarDayIndex(endYmd) - calendarDayIndex(todayYmd);
  if (daysLeft < 0) {
    return { state: 'VENCIDA', daysLeft };
  }
  return { state: 'VIGENTE', daysLeft };
}
