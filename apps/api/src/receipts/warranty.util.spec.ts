import { addMonthsBogota, computeWarrantyEnd, warrantyStatus } from './warranty.util';
import { bogotaDateTimeUtc } from './bogota-time.util';

describe('warranty.util', () => {
  it('suma 12 meses manteniendo el día', () => {
    const start = bogotaDateTimeUtc({ year: 2026, month: 1, day: 15 }, 10, 0, 0, 0);
    const end = addMonthsBogota(start, 12);
    expect(end.toISOString()).toBe(
      bogotaDateTimeUtc({ year: 2027, month: 1, day: 15 }, 23, 59, 59, 999).toISOString(),
    );
  });

  it('ajusta a fin de mes en febrero no bisiesto', () => {
    const start = bogotaDateTimeUtc({ year: 2027, month: 1, day: 31 }, 12, 0, 0, 0);
    const end = addMonthsBogota(start, 1);
    expect(end.toISOString()).toBe(
      bogotaDateTimeUtc({ year: 2027, month: 2, day: 28 }, 23, 59, 59, 999).toISOString(),
    );
  });

  it('ajusta a fin de mes en febrero bisiesto', () => {
    const start = bogotaDateTimeUtc({ year: 2028, month: 1, day: 31 }, 12, 0, 0, 0);
    const end = addMonthsBogota(start, 1);
    expect(end.toISOString()).toBe(
      bogotaDateTimeUtc({ year: 2028, month: 2, day: 29 }, 23, 59, 59, 999).toISOString(),
    );
  });

  it('0 meses = sin garantía', () => {
    const start = bogotaDateTimeUtc({ year: 2026, month: 5, day: 1 }, 8, 0, 0, 0);
    expect(computeWarrantyEnd(start, 0)).toBeNull();
    expect(warrantyStatus(null).state).toBe('SIN_GARANTIA');
  });

  it('usa la fecha Bogotá aunque en UTC ya sea el día siguiente', () => {
    // 31-dic 23:30 Bogotá = 1-ene 04:30 UTC
    const start = bogotaDateTimeUtc({ year: 2026, month: 12, day: 31 }, 23, 30, 0, 0);
    const end = addMonthsBogota(start, 1);
    expect(end.toISOString()).toBe(
      bogotaDateTimeUtc({ year: 2027, month: 1, day: 31 }, 23, 59, 59, 999).toISOString(),
    );
  });

  it('el último día de vigencia cuenta como vigente con daysLeft 0', () => {
    const endsAt = bogotaDateTimeUtc({ year: 2026, month: 6, day: 10 }, 23, 59, 59, 999);
    const lastDayNoon = bogotaDateTimeUtc({ year: 2026, month: 6, day: 10 }, 12, 0, 0, 0);
    expect(warrantyStatus(endsAt, lastDayNoon)).toEqual({
      state: 'VIGENTE',
      daysLeft: 0,
    });
  });

  it('el día siguiente a la vigencia está vencida', () => {
    const endsAt = bogotaDateTimeUtc({ year: 2026, month: 6, day: 10 }, 23, 59, 59, 999);
    const nextDay = bogotaDateTimeUtc({ year: 2026, month: 6, day: 11 }, 0, 30, 0, 0);
    expect(warrantyStatus(endsAt, nextDay)).toEqual({
      state: 'VENCIDA',
      daysLeft: -1,
    });
  });
});
