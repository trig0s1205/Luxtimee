import {
  planSkuRecompute,
  recomputeSkuKeepingSequence,
  resolveSkuPrefix,
} from './sku.util';

describe('resolveSkuPrefix', () => {
  it('clasifica dama, media, alta y premium', () => {
    expect(resolveSkuPrefix(200_000, 'Mujer')).toBe('RD');
    expect(resolveSkuPrefix(10_000, 'dama')).toBe('RD');
    expect(resolveSkuPrefix(80_000, 'Hombre')).toBe('RM');
    expect(resolveSkuPrefix(80_001, 'Unisex')).toBe('RA');
    expect(resolveSkuPrefix(100_000, 'Hombre')).toBe('RA');
    expect(resolveSkuPrefix(100_001, null)).toBe('RP');
    expect(resolveSkuPrefix(95_000, 'Hombre')).toBe('RA');
  });
});

describe('recomputeSkuKeepingSequence', () => {
  it('cambia solo el prefijo y conserva el número', () => {
    expect(recomputeSkuKeepingSequence('RM-489', 95_000, 'Hombre')).toBe('RA-489');
    expect(recomputeSkuKeepingSequence('rm-7', 150_000, 'Unisex')).toBe('RP-007');
    expect(recomputeSkuKeepingSequence('RA-489', 95_000, 'Hombre')).toBe('RA-489');
    expect(recomputeSkuKeepingSequence('RM-489', 120_000, 'Mujer')).toBe('RD-489');
  });

  it('no toca códigos que no son prefijo y consecutivo', () => {
    expect(recomputeSkuKeepingSequence('LUX-LEG-ab12cd', 95_000, 'Hombre')).toBeNull();
  });
});

describe('planSkuRecompute', () => {
  it('reubica RM-489 de 95.000 en RA-489', () => {
    const plan = planSkuRecompute([
      { id: 'a', sku: 'RM-489', retailPrice: 95_000, gender: 'Hombre' },
    ]);
    expect(plan).toEqual([
      { id: 'a', from: 'RM-489', to: 'RA-489', keptSequence: true },
    ]);
  });

  it('si el número destino está ocupado, usa el siguiente libre', () => {
    const plan = planSkuRecompute([
      { id: 'keep', sku: 'RA-489', retailPrice: 90_000, gender: 'Hombre' },
      { id: 'move', sku: 'RM-489', retailPrice: 95_000, gender: 'Hombre' },
    ]);
    expect(plan).toEqual([
      { id: 'move', from: 'RM-489', to: 'RA-490', keptSequence: false },
    ]);
  });
});
