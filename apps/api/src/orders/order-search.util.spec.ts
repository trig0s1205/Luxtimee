import { buildOrderSearchWhere } from './order-search.util';

describe('buildOrderSearchWhere', () => {
  it('busca el snapshot histórico y el SKU vivo con guion o sin él', () => {
    const where = buildOrderSearchWhere('rm-489');
    expect(where).not.toBeNull();
    const serialized = JSON.stringify(where);
    expect(serialized).toContain('productSku');
    expect(serialized).toContain('RM-489');
    expect(serialized).toContain('RM489');
    expect(serialized).toContain('customerName');
  });

  it('ignora un término vacío', () => {
    expect(buildOrderSearchWhere('   ')).toBeNull();
  });
});
