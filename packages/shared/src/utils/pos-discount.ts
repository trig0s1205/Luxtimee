export type PosDiscountSpec = {
  amount?: number | null;
  percent?: number | null;
};

export type PosDiscountResult =
  | { ok: true; discount: number }
  | { ok: false; message: string };

function provided(value: number | null | undefined): value is number {
  return value !== undefined && value !== null;
}

/** Descuento de línea o de venta. No acepta monto y porcentaje a la vez. */
export function resolvePosDiscount(
  gross: number,
  spec: PosDiscountSpec,
): PosDiscountResult {
  if (!Number.isInteger(gross) || gross < 0) {
    return { ok: false, message: 'El subtotal del descuento no es válido' };
  }
  const hasAmount = provided(spec.amount);
  const hasPercent = provided(spec.percent);
  if (hasAmount && hasPercent) {
    return {
      ok: false,
      message: 'Indica el descuento en monto o en porcentaje, no ambos',
    };
  }
  if (!hasAmount && !hasPercent) return { ok: true, discount: 0 };
  if (hasPercent) {
    const percent = spec.percent ?? 0;
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      return { ok: false, message: 'El porcentaje de descuento debe estar entre 0 y 100' };
    }
    return { ok: true, discount: Math.round((gross * percent) / 100) };
  }
  const amount = spec.amount as number;
  if (!Number.isInteger(amount) || amount < 0) {
    return { ok: false, message: 'El monto del descuento no es válido' };
  }
  if (amount > gross) {
    return { ok: false, message: 'El descuento no puede superar el subtotal' };
  }
  return { ok: true, discount: amount };
}
