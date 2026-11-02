import { DEPOSIT_PER_UNIT_COP } from '../constants.js';

export function depositForUnits(unitCount: number): number {
  const units = Number.isFinite(unitCount) ? Math.max(0, Math.floor(unitCount)) : 0;
  return units * DEPOSIT_PER_UNIT_COP;
}

export function depositCharge(unitCount: number, orderTotal: number): number {
  const expected = depositForUnits(unitCount);
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) return expected;
  return Math.min(expected, Math.floor(orderTotal));
}

export function formatCopAmount(value: number): string {
  return `$${Math.round(value).toLocaleString('es-CO')}`;
}

export function depositBreakdownLabel(unitCount: number): string {
  const units = Math.max(0, Math.floor(Number.isFinite(unitCount) ? unitCount : 0));
  const noun = units === 1 ? 'reloj' : 'relojes';
  return `${units} ${noun} x ${formatCopAmount(DEPOSIT_PER_UNIT_COP)}`;
}

export function depositConfirmLabel(unitCount: number, amount: number): string {
  return `Confirmar abono de ${formatCopAmount(amount)} (${depositBreakdownLabel(unitCount)})`;
}
