import { linesFromOrder, payrollFund, profitPeriodRange } from './profit-math';

const PAID = new Date('2026-11-26T18:00:00.000Z');

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    readableId: 'LX-1',
    type: 'DETAL',
    status: 'ENTREGADO',
    source: 'LOCAL',
    subtotal: 100_000,
    discountAmount: 10_000,
    total: 90_000,
    shippingCost: 0,
    payments: [{ amount: 90_000, paidAt: PAID, method: 'EFECTIVO' }],
    items: [
      {
        unitPrice: 100_000,
        quantity: 1,
        discountAmount: 10_000,
        productName: 'Reloj',
        productSku: 'RA-1',
        watch: { cost: 60_000, brand: { name: 'Rolex' } },
      },
    ],
    ...overrides,
  };
}

describe('matemática de ganancia', () => {
  it('el descuento no reduce el costo', () => {
    const { lines } = linesFromOrder(order());
    expect(lines[0].revenue).toBe(90_000);
    expect(lines[0].cost).toBe(60_000);
    expect(lines[0].profit).toBe(30_000);
    expect(lines[0].gross).toBe(100_000);
    expect(lines[0].discount).toBe(10_000);
  });

  it('un costo nulo no cuenta como cero en la ganancia', () => {
    const { lines } = linesFromOrder(
      order({
        items: [
          {
            unitPrice: 100_000,
            quantity: 1,
            discountAmount: 0,
            productName: 'Sin costo',
            watch: { cost: null },
          },
        ],
        subtotal: 100_000,
        discountAmount: 0,
        total: 100_000,
        payments: [{ amount: 100_000, paidAt: PAID }],
      }),
    );
    expect(lines[0].revenue).toBe(100_000);
    expect(lines[0].costStatus).toBe('MISSING');
    expect(lines[0].profit).toBe(0);
    expect(lines[0].cost).toBe(0);
  });

  it('separa local y web', () => {
    const local = linesFromOrder(order({ source: 'LOCAL' })).lines[0];
    const web = linesFromOrder(order({ source: 'WHATSAPP' })).lines[0];
    expect(local.channel).toBe('LOCAL');
    expect(web.channel).toBe('WEB');
  });

  it('el fondo es un porcentaje de lo facturado, no de la ganancia', () => {
    const fund = payrollFund({
      invoiced: 1_000_000,
      percent: 7,
      payroll: 100_000,
      channelInvoiced: 400_000,
    });
    expect(fund.fund).toBe(70_000);
    expect(fund.channelFund).toBe(28_000);
    expect(fund.surplus).toBe(-30_000);
    expect(fund.neededPercent).toBeCloseTo(10);
    expect(fund.salesToCover).toBe(1_428_572);
  });

  it('hoy en Bogotá no usa la medianoche UTC', () => {
    const eveningBefore = new Date('2026-11-26T02:00:00.000Z');
    const range = profitPeriodRange('day', eveningBefore);
    expect(range.since?.toISOString()).toBe('2026-11-25T05:00:00.000Z');
    const morning = new Date('2026-11-26T06:00:00.000Z');
    expect(profitPeriodRange('day', morning).since?.toISOString()).toBe(
      '2026-11-26T05:00:00.000Z',
    );
    expect(profitPeriodRange('month', morning).since?.toISOString()).toBe(
      '2026-11-01T05:00:00.000Z',
    );
  });

  it('usa el costo guardado y marca el costo actual como estimado', () => {
    const snap = linesFromOrder(
      order({
        discountAmount: 0,
        total: 100_000,
        subtotal: 100_000,
        payments: [{ amount: 100_000, paidAt: PAID }],
        items: [
          {
            unitPrice: 100_000,
            quantity: 1,
            discountAmount: 0,
            unitCostSnapshot: 55_000,
            watch: { cost: 10_000 },
          },
        ],
      }),
    ).lines[0];
    expect(snap.cost).toBe(55_000);
    expect(snap.costStatus).toBe('SNAPSHOT');

    const estimated = linesFromOrder(
      order({
        discountAmount: 0,
        total: 100_000,
        subtotal: 100_000,
        payments: [{ amount: 100_000, paidAt: PAID }],
        items: [
          {
            unitPrice: 100_000,
            quantity: 1,
            discountAmount: 0,
            watch: { cost: 10_000 },
          },
        ],
      }),
    ).lines[0];
    expect(estimated.cost).toBe(10_000);
    expect(estimated.costStatus).toBe('ESTIMATED');
  });
});
