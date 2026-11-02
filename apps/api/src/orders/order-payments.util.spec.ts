import {
  cashEventsForOrder,
  recognizeCollected,
} from './order-payments.util';

const abonoAt = new Date('2026-10-15T12:00:00.000Z');
const saldoAt = new Date('2026-11-02T12:00:00.000Z');

describe('reconocimiento de abono y saldo', () => {
  const events = [
    { amount: 100_000, paidAt: abonoAt },
    { amount: 420_000, paidAt: saldoAt },
  ];
  const base = {
    subtotal: 500_000,
    shippingCost: 20_000,
    events,
  };

  it('el abono entra completo a relojes y el saldo completa relojes y domicilio sin duplicar', () => {
    const october = recognizeCollected({
      ...base,
      since: new Date('2026-10-01T00:00:00.000Z'),
      until: new Date('2026-11-01T00:00:00.000Z'),
    });
    const november = recognizeCollected({
      ...base,
      since: new Date('2026-11-01T00:00:00.000Z'),
      until: new Date('2026-12-01T00:00:00.000Z'),
    });
    const all = recognizeCollected(base);

    expect(october).toMatchObject({ product: 100_000, shipping: 0, collected: 100_000 });
    expect(november).toMatchObject({ product: 400_000, shipping: 20_000, collected: 420_000 });
    expect(all.product).toBe(october.product + november.product);
    expect(all.shipping).toBe(october.shipping + november.shipping);
    expect(all.product + all.shipping).toBe(520_000);
  });

  it('un pedido pendiente con abono no reconoce el saldo', () => {
    const eventsOnlyDeposit = cashEventsForOrder({
      total: 500_000,
      status: 'PENDIENTE',
      depositConfirmed: true,
      depositExpected: 100_000,
      updatedAt: abonoAt,
      payments: [],
    });
    expect(eventsOnlyDeposit).toEqual([{ amount: 100_000, paidAt: abonoAt }]);
  });

  it('un pedido ya liquidado sin filas de pago conserva el total una sola vez', () => {
    const eventsSettled = cashEventsForOrder({
      total: 500_000,
      status: 'ENTREGADO',
      paidAt: saldoAt,
      depositConfirmed: true,
      depositExpected: 100_000,
      payments: [],
    });
    expect(eventsSettled).toEqual([{ amount: 500_000, paidAt: saldoAt }]);
  });

  it('si ya hay abono y saldo no suma otra vez el total', () => {
    const recorded = cashEventsForOrder({
      total: 500_000,
      status: 'ENTREGADO',
      paidAt: saldoAt,
      depositConfirmed: true,
      depositExpected: 100_000,
      payments: [
        { amount: 100_000, paidAt: abonoAt },
        { amount: 400_000, paidAt: saldoAt },
      ],
    });
    expect(recorded.map((event) => event.amount)).toEqual([100_000, 400_000]);
    const recognized = recognizeCollected({
      subtotal: 500_000,
      shippingCost: 0,
      events: recorded,
    });
    expect(recognized.product).toBe(500_000);
    expect(recognized.shipping).toBe(0);
  });
});
