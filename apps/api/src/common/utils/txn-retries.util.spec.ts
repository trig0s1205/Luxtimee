import { Prisma } from '@prisma/client';
import { isTransientTxnError, withTxnRetries } from './txn-retries.util';

describe('withTxnRetries', () => {
  it('detecta P2002 de readableId y P2034', () => {
    expect(
      isTransientTxnError(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['readableId'] },
        }),
      ),
    ).toBe(true);
    expect(
      isTransientTxnError(
        new Prisma.PrismaClientKnownRequestError('write conflict', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      ),
    ).toBe(true);
    expect(isTransientTxnError(new Error('stock insuficiente'))).toBe(false);
  });

  it('reintenta y eventualmente cumple', async () => {
    let n = 0;
    const result = await withTxnRetries(
      async () => {
        n += 1;
        if (n < 3) {
          throw new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['readableId'] },
          });
        }
        return 'ok';
      },
      { maxAttempts: 5 },
    );
    expect(result).toBe('ok');
    expect(n).toBe(3);
  });
});
