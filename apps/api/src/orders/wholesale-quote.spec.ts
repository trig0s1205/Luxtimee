import { quoteWholesaleCart } from '@luxtime/shared';

describe('quoteWholesaleCart', () => {
  const extras = [
    { id: 'caja', name: 'Caja', price: 5000 },
    { id: 'pila', name: 'Pila', price: 2000 },
  ];
  const packages = [
    {
      id: 'diez',
      name: '10 relojes',
      minQuantity: 10,
      unitPrice: 40000,
      watchIds: [] as string[],
    },
  ];

  it('no baja el piso si no hay extras ni paquete', () => {
    const quote = quoteWholesaleCart(
      [{ watchId: 'w1', quantity: 4, wholesalePrice: 50000, extras: [] }],
      extras,
      packages,
    );
    expect(quote.lines[0].unitPrice).toBe(50000);
    expect(quote.subtotal).toBe(200000);
    expect(quote.offers[0].applied).toBe(false);
  });

  it('suma extras por reloj y no acepta quitar por debajo del piso', () => {
    const quote = quoteWholesaleCart(
      [{
        watchId: 'w1',
        quantity: 2,
        wholesalePrice: 50000,
        extras: [{ extraId: 'caja', quantity: 1 }],
      }],
      extras,
      packages,
    );
    expect(quote.lines[0].unitPrice).toBe(55000);
    expect(quote.lines[0].lineTotal).toBe(110000);
  });

  it('aplica el paquete más barato al llegar a la cantidad y suma extras encima', () => {
    const quote = quoteWholesaleCart(
      [{
        watchId: 'w1',
        quantity: 10,
        wholesalePrice: 50000,
        extras: [{ extraId: 'pila', quantity: 1 }],
      }],
      extras,
      [
        ...packages,
        {
          id: 'caro',
          name: 'Caro',
          minQuantity: 10,
          unitPrice: 45000,
          watchIds: [],
        },
      ],
    );
    expect(quote.lines[0].packageName).toBe('10 relojes');
    expect(quote.lines[0].unitPrice).toBe(42000);
    expect(quote.subtotal).toBe(420000);
  });

  it('un paquete de modelos no cubre otros relojes', () => {
    const quote = quoteWholesaleCart(
      [
        { watchId: 'a', quantity: 10, wholesalePrice: 50000 },
        { watchId: 'b', quantity: 10, wholesalePrice: 50000 },
      ],
      extras,
      [{ ...packages[0], watchIds: ['a'] }],
    );
    expect(quote.lines[0].packageId).toBe('diez');
    expect(quote.lines[1].packageId).toBeNull();
  });

  it('rechaza un extra que no existe', () => {
    expect(() =>
      quoteWholesaleCart(
        [{ watchId: 'w1', quantity: 1, wholesalePrice: 50000, extras: [{ extraId: 'no', quantity: 1 }] }],
        extras,
        packages,
      ),
    ).toThrow('Esa opción extra no está disponible');
  });
});
