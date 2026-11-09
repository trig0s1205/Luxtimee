/**
 * Tests de concurrencia reales (stock + consecutivos de comprobante).
 * Solo corren si DATABASE_URL apunta a Postgres local.
 */
const dbUrl = process.env.DATABASE_URL ?? '';
const isLocalDb = /localhost|127\.0\.0\.1/.test(dbUrl);

(isLocalDb ? describe : describe.skip)('POS concurrency (localhost DB)', () => {
  it.todo(
    'dos createSale en paralelo con stock 1 → una ok y una Stock insuficiente',
  );
  it.todo(
    '15 emisiones paralelas → sequences consecutivos; rollback no consume número',
  );
});
