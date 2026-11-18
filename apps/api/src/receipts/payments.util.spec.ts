import { BadRequestException } from '@nestjs/common';
import { validatePosPayments } from './payments.util';

describe('validatePosPayments', () => {
  it('acepta efectivo + Bold que suman el total', () => {
    const result = validatePosPayments(150_000, [
      { method: 'EFECTIVO', amount: 50_000, cashReceived: 60_000 },
      { method: 'DATAFONO_BOLD', amount: 100_000, approvalCode: '123456' },
    ]);
    expect(result.changeTotal).toBe(10_000);
    expect(result.normalized).toHaveLength(2);
    expect(result.normalized[0]).toMatchObject({
      method: 'EFECTIVO',
      changeGiven: 10_000,
      cashReceived: 60_000,
    });
    expect(result.normalized[1]).toMatchObject({
      method: 'DATAFONO_BOLD',
      reference: '123456',
      cashReceived: null,
      changeGiven: null,
    });
  });

  it('rechaza suma distinta al total', () => {
    expect(() =>
      validatePosPayments(100_000, [
        { method: 'TRANSFERENCIA', amount: 90_000, reference: 'ref' },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rechaza dos líneas de efectivo', () => {
    expect(() =>
      validatePosPayments(100_000, [
        { method: 'EFECTIVO', amount: 40_000, cashReceived: 40_000 },
        { method: 'EFECTIVO', amount: 60_000, cashReceived: 60_000 },
      ]),
    ).toThrow(/Solo se permite una línea de efectivo/);
  });

  it('rechaza efectivo recibido menor al monto', () => {
    expect(() =>
      validatePosPayments(50_000, [
        { method: 'EFECTIVO', amount: 50_000, cashReceived: 40_000 },
      ]),
    ).toThrow(/efectivo recibido es menor/);
  });

  it('rechaza Bold sin aprobación', () => {
    expect(() =>
      validatePosPayments(80_000, [{ method: 'DATAFONO_BOLD', amount: 80_000 }]),
    ).toThrow(/número de aprobación/);
  });

  it('rechaza cardLast4 inválidos', () => {
    expect(() =>
      validatePosPayments(80_000, [
        {
          method: 'DATAFONO_BOLD',
          amount: 80_000,
          approvalCode: '998877',
          cardLast4: '12a4',
        },
      ]),
    ).toThrow(/últimos 4/);
  });
});
