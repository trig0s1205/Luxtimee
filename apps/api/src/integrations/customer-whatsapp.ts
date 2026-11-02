import { depositBreakdownLabel, formatCopAmount } from '@luxtime/shared';

export function buildCustomerWhatsappUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10) digits = `57${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function customerStatusWhatsappMessage(order: {
  readableId: string;
  stage: string;
  status: string | null;
  depositConfirmed: boolean;
  depositExpected?: number | null;
  depositPaid?: number | null;
  unitCount?: number | null;
  total?: number | null;
  suspendedAt: Date | string | null;
  canceledAt: Date | string | null;
}): string {
  const id = order.readableId;
  const units = order.unitCount ?? 0;
  const quoted =
    order.depositPaid && order.depositPaid > 0
      ? order.depositPaid
      : order.depositExpected && order.depositExpected > 0
        ? Math.min(order.depositExpected, order.total ?? order.depositExpected)
        : 0;
  const detail =
    quoted > 0
      ? `${formatCopAmount(quoted)}${units > 0 ? ` (${depositBreakdownLabel(units)})` : ''}`
      : '';
  if (order.canceledAt || order.status === 'CANCELADO') {
    return `Hola, te escribimos de LUXTIMEE. Tu pedido ${id} fue cancelado.`;
  }
  if (order.suspendedAt && order.stage === 'PRE_ORDER') {
    return detail
      ? `Hola, te escribimos de LUXTIMEE. Tu pre-pedido ${id} quedó suspendido porque no se confirmó el abono de ${detail}. Responde este mensaje para reactivarlo.`
      : `Hola, te escribimos de LUXTIMEE. Tu pre-pedido ${id} quedó suspendido. Responde este mensaje para reactivarlo.`;
  }
  if (order.status === 'ENVIADO') {
    return `Hola, te escribimos de LUXTIMEE. Tu pedido ${id} fue enviado.`;
  }
  if (order.depositConfirmed || order.stage === 'ORDER') {
    return detail
      ? `Hola, te escribimos de LUXTIMEE. Confirmamos el abono de ${detail} de tu pedido ${id}.`
      : `Hola, te escribimos de LUXTIMEE. Confirmamos el abono de tu pedido ${id}.`;
  }
  const pending = detail;
  return pending
    ? `Hola, te escribimos de LUXTIMEE. Recibimos tu pre-pedido ${id}. El abono para confirmarlo es ${pending}.`
    : `Hola, te escribimos de LUXTIMEE. Recibimos tu pre-pedido ${id}.`;
}
