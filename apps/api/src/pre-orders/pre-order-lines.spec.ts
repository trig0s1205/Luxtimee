import {
  mergePreOrderItems,
  repricePreservedWholesaleLine,
} from './pre-order-lines';

describe('mergePreOrderItems', () => {
  it('suma cantidades y extras del mismo reloj', () => {
    expect(
      mergePreOrderItems([
        {
          watchId: 'a',
          quantity: 2,
          extras: [{ extraId: 'caja', quantity: 1 }],
        },
        {
          watchId: 'a',
          quantity: 3,
          deliveryNote: 'urgente',
          extras: [{ extraId: 'caja', quantity: 1 }],
        },
        { watchId: 'b', quantity: 1 },
      ]),
    ).toEqual([
      {
        watchId: 'a',
        quantity: 5,
        deliveryNote: 'urgente',
        extras: [{ extraId: 'caja', quantity: 2 }],
      },
      { watchId: 'b', quantity: 1, deliveryNote: null, extras: [] },
    ]);
  });
});

describe('repricePreservedWholesaleLine', () => {
  it('conserva el precio del snapshot aunque el extra ya no exista', () => {
    const priced = repricePreservedWholesaleLine({
      quantity: 2,
      previousUnitPrice: 45000,
      previousExtras: [
        { extraId: 'caja', name: 'Caja', unitPrice: 5000, quantity: 1 },
      ],
      requestedExtras: [{ extraId: 'caja', quantity: 1 }],
      catalogExtras: [],
    });
    expect(priced.unitPrice).toBe(45000);
    expect(priced.lineTotal).toBe(90000);
    expect(priced.extras).toEqual([
      { extraId: 'caja', name: 'Caja', unitPrice: 5000, quantity: 1 },
    ]);
  });

  it('cotiza un extra nuevo con el catálogo y rechaza uno borrado', () => {
    const priced = repricePreservedWholesaleLine({
      quantity: 1,
      previousUnitPrice: 40000,
      previousExtras: [],
      requestedExtras: [{ extraId: 'pila', quantity: 2 }],
      catalogExtras: [{ id: 'pila', name: 'Pila', price: 2000 }],
    });
    expect(priced.unitPrice).toBe(44000);

    expect(() =>
      repricePreservedWholesaleLine({
        quantity: 1,
        previousUnitPrice: 40000,
        previousExtras: [],
        requestedExtras: [{ extraId: 'no', quantity: 1 }],
        catalogExtras: [],
      }),
    ).toThrow('Esa opción extra no está disponible');
  });
});
