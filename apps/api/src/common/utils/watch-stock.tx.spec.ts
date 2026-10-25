import { reserveWatchStock, restoreWatchStock } from './watch-stock.tx';

describe('stock en lote', () => {
  it('reserva líneas repetidas en una sola sentencia', async () => {
    const calls: unknown[][] = [];
    const tx = {
      $queryRawUnsafe: async (...args: unknown[]) => {
        calls.push(args);
        return [{ id: 'a' }, { id: 'b' }];
      },
    };
    await reserveWatchStock(tx as never, [
      { watchId: 'a', quantity: 1 },
      { watchId: 'a', quantity: 1 },
      { watchId: 'b', quantity: 2 },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual(['a', 'b']);
    expect(calls[0][2]).toEqual([2, 2]);
    expect(String(calls[0][0])).toContain('unnest');
  });

  it('repone en una sola sentencia', async () => {
    const calls: unknown[][] = [];
    const tx = {
      $queryRawUnsafe: async (...args: unknown[]) => {
        calls.push(args);
        return [{ id: 'a' }];
      },
    };
    await restoreWatchStock(tx as never, [
      { watchId: 'a', quantity: 2 },
      { watchId: 'a', quantity: 2 },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual([4]);
  });

  it('falla con Stock insuficiente si no actualiza todas las líneas', async () => {
    const tx = {
      $queryRawUnsafe: async () => [],
      watch: { findMany: async () => [{ isActive: true, deletedAt: null }] },
    };
    await expect(
      reserveWatchStock(
        tx as never,
        [{ watchId: 'a', quantity: 3 }],
        { requireActive: true, message: 'Stock insuficiente para este reloj' },
      ),
    ).rejects.toThrow(/Stock insuficiente/);
  });
});
