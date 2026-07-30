import { OrderType, PriceType } from '@prisma/client';
import { priceOrderLines, resolveOrderType } from './order-pricing.util';
import { assertValidTransition } from './state-machine';
import { OrderStatus } from '@prisma/client';

describe('order-pricing', () => {
  it('retail siempre cobra al detal aunque haya 4+ unidades', () => {
    expect(resolveOrderType(3, 'retail')).toBe(OrderType.DETAL);
    expect(resolveOrderType(4, 'retail')).toBe(OrderType.DETAL);
    const priced = priceOrderLines([
      {
        watchId: '1',
        quantity: 2,
        retailPrice: 100,
        wholesalePrice: 80,
        productName: 'A',
        productRef: 'a',
      },
      {
        watchId: '2',
        quantity: 2,
        retailPrice: 100,
        wholesalePrice: 80,
        productName: 'B',
        productRef: 'b',
      },
    ], 0, 'retail');
    expect(priced.type).toBe(OrderType.DETAL);
    expect(priced.lines[0].unitPrice).toBe(100);
    expect(priced.lines[0].priceType).toBe(PriceType.RETAIL);
  });

  it('canal mayorista aplica precio wholesale', () => {
    const priced = priceOrderLines([
      {
        watchId: '1',
        quantity: 1,
        retailPrice: 100,
        wholesalePrice: 80,
        productName: 'A',
        productRef: 'a',
      },
    ], 0, 'wholesale');
    expect(priced.type).toBe(OrderType.MAYORISTA);
    expect(priced.lines[0].unitPrice).toBe(80);
    expect(priced.lines[0].priceType).toBe(PriceType.WHOLESALE);
    expect(priced.depositExpected).toBe(10000);
  });
});

describe('state-machine', () => {
  it('rechaza transiciones inválidas', () => {
    expect(() => assertValidTransition(OrderStatus.PENDIENTE, OrderStatus.ENTREGADO)).toThrow();
    expect(() => assertValidTransition(OrderStatus.PENDIENTE, OrderStatus.PAGADO)).not.toThrow();
  });

  it('omite enviado en pedidos locales', () => {
    expect(() => assertValidTransition(OrderStatus.PAGADO, OrderStatus.ENVIADO, false)).toThrow();
    expect(() => assertValidTransition(OrderStatus.PAGADO, OrderStatus.ENTREGADO, false)).not.toThrow();
    expect(() => assertValidTransition(OrderStatus.PAGADO, OrderStatus.ENVIADO, true)).not.toThrow();
  });
});
