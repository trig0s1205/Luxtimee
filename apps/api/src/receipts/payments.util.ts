import { BadRequestException } from '@nestjs/common';
import { formatCopAmount } from '@luxtime/shared';

export type PosPaymentInput = {
  method: 'EFECTIVO' | 'TRANSFERENCIA' | 'DATAFONO_BOLD';
  amount: number;
  cashReceived?: number;
  reference?: string;
  proofUrl?: string;
  approvalCode?: string;
  cardLast4?: string;
};

export type NormalizedPosPayment = {
  method: PosPaymentInput['method'];
  amount: number;
  cashReceived: number | null;
  changeGiven: number | null;
  reference: string | null;
  proofUrl: string | null;
  cardLast4: string | null;
};

export function validatePosPayments(
  total: number,
  payments: PosPaymentInput[],
): { normalized: NormalizedPosPayment[]; changeTotal: number } {
  if (!Array.isArray(payments) || payments.length === 0) {
    throw new BadRequestException('Debes registrar al menos un método de pago');
  }

  let cashLines = 0;
  let sum = 0;
  let changeTotal = 0;
  const normalized: NormalizedPosPayment[] = [];

  for (const payment of payments) {
    if (!Number.isInteger(payment.amount) || payment.amount <= 0) {
      throw new BadRequestException('Cada monto de pago debe ser un entero mayor a 0');
    }
    sum += payment.amount;

    if (payment.method === 'EFECTIVO') {
      cashLines += 1;
      if (cashLines > 1) {
        throw new BadRequestException('Solo se permite una línea de efectivo');
      }
      const received = payment.cashReceived;
      if (!Number.isInteger(received) || received! < payment.amount) {
        throw new BadRequestException(
          'El efectivo recibido es menor al monto en efectivo',
        );
      }
      const changeGiven = received! - payment.amount;
      changeTotal += changeGiven;
      normalized.push({
        method: 'EFECTIVO',
        amount: payment.amount,
        cashReceived: received!,
        changeGiven,
        reference: null,
        proofUrl: null,
        cardLast4: null,
      });
      continue;
    }

    if (payment.method === 'DATAFONO_BOLD') {
      const code = payment.approvalCode?.trim() ?? '';
      if (!/^\d{4,12}$/.test(code)) {
        throw new BadRequestException(
          'Ingresa el número de aprobación del datáfono',
        );
      }
      const last4 = payment.cardLast4?.trim();
      if (last4 && !/^\d{4}$/.test(last4)) {
        throw new BadRequestException(
          'Los últimos 4 dígitos de la tarjeta deben ser exactamente 4 números',
        );
      }
      normalized.push({
        method: 'DATAFONO_BOLD',
        amount: payment.amount,
        cashReceived: null,
        changeGiven: null,
        reference: code,
        proofUrl: payment.proofUrl?.trim() || null,
        cardLast4: last4 || null,
      });
      continue;
    }

    normalized.push({
      method: 'TRANSFERENCIA',
      amount: payment.amount,
      cashReceived: null,
      changeGiven: null,
      reference: payment.reference?.trim() || null,
      proofUrl: payment.proofUrl?.trim() || null,
      cardLast4: null,
    });
  }

  if (sum !== total) {
    throw new BadRequestException(
      `La suma de los pagos (${formatCopAmount(sum)}) no coincide con el total (${formatCopAmount(total)})`,
    );
  }

  return { normalized, changeTotal };
}
