import { bogotaDayRange } from './bogota-time.util';

describe('bogotaDayRange', () => {
  it('devuelve el día civil Bogotá en UTC', () => {
    const { start, end } = bogotaDayRange('2026-11-08');
    expect(start.toISOString()).toBe('2026-11-08T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-09T05:00:00.000Z');
  });
});
