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
  suspendedAt: Date | string | null;
  canceledAt: Date | string | null;
}): string {
  const id = order.readableId;
  if (order.canceledAt || order.status === 'CANCELADO') {
    return `Hola, te escribimos de LUXTIMEE. Tu pedido ${id} fue cancelado.`;
  }
  if (order.suspendedAt && order.stage === 'PRE_ORDER') {
    return `Hola, te escribimos de LUXTIMEE. Tu pre-pedido ${id} quedó suspendido. Responde este mensaje para reactivarlo.`;
  }
  if (order.status === 'ENVIADO') {
    return `Hola, te escribimos de LUXTIMEE. Tu pedido ${id} fue enviado.`;
  }
  if (order.depositConfirmed || order.stage === 'ORDER') {
    return `Hola, te escribimos de LUXTIMEE. Confirmamos el abono de tu pedido ${id}.`;
  }
  return `Hola, te escribimos de LUXTIMEE. Recibimos tu pre-pedido ${id}.`;
}
