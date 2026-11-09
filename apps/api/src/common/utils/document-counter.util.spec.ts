import {
  bogotaYmdCompact,
  formatOrderReadableId,
  nextDocumentSequence,
  nextOrderReadableId,
  orderReadableIdKey,
} from './document-counter.util';
import { generateReadableId } from '../../orders/order-pricing.util';

describe('document-counter / readableId', () => {
  it('formatOrderReadableId y generateReadableId usan día Bogotá', () => {
    // 2026-11-10 02:30 UTC = 2026-11-09 21:30 Bogotá
    const bogotaEvening = new Date('2026-11-10T02:30:00.000Z');
    expect(bogotaYmdCompact(bogotaEvening)).toBe('20261109');
    expect(formatOrderReadableId('20261109', 7)).toBe('LX-20261109-0007');
    expect(generateReadableId(7, bogotaEvening)).toBe('LX-20261109-0007');
    expect(orderReadableIdKey('20261109')).toBe('ORDER_LX_20261109');
  });

  it('nextDocumentSequence hace INSERT … ON CONFLICT incrementando', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ lastValue: 1 }])
      .mockResolvedValueOnce([{ lastValue: 2 }]);
    const tx = { $queryRaw: queryRaw };
    await expect(nextDocumentSequence(tx as never, 'TEST_KEY', 1)).resolves.toBe(
      1,
    );
    await expect(nextDocumentSequence(tx as never, 'TEST_KEY', 1)).resolves.toBe(
      2,
    );
    expect(queryRaw).toHaveBeenCalledTimes(2);
    const sql = String(queryRaw.mock.calls[0][0]?.strings?.join('') ?? queryRaw.mock.calls[0][0]);
    expect(sql).toMatch(/ON CONFLICT/i);
    expect(sql).toMatch(/lastValue/i);
  });

  it('nextOrderReadableId siembra desde el máximo existente del día', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ max_seq: 12 }])
      .mockResolvedValueOnce([{ lastValue: 13 }]);
    const tx = { $queryRaw: queryRaw };
    const now = new Date('2026-11-09T18:00:00.000Z');
    await expect(nextOrderReadableId(tx as never, now)).resolves.toBe(
      'LX-20261109-0013',
    );
  });
});
