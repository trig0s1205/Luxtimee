/** Offset fijo Bogotá (UTC-5, sin horario de verano). */
export const BOGOTA_OFFSET_MINUTES = -300;

export type BogotaDateParts = {
  year: number;
  month: number;
  day: number;
};

export function bogotaDateParts(date: Date): BogotaDateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day };
}

/** Inicio inclusive y fin exclusivo del día civil en Bogotá, en UTC. */
export function bogotaDayRange(ymd: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    throw new Error(`Fecha inválida: ${ymd}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // 00:00 Bogotá = 05:00 UTC
  const start = new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function todayBogotaYmd(now = new Date()): string {
  const { year, month, day } = bogotaDateParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatBogotaDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatBogotaDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Construye un instante UTC que representa hora:minuto:segundo.ms de un día Bogotá. */
export function bogotaDateTimeUtc(
  parts: BogotaDateParts,
  hours: number,
  minutes: number,
  seconds: number,
  ms: number,
): Date {
  // Bogotá = UTC-5 → UTC = local + 5h
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, hours + 5, minutes, seconds, ms),
  );
}
