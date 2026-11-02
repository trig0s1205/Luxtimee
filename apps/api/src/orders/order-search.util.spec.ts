import { foldedOrderSearchTerms } from './order-search.util';

describe('foldedOrderSearchTerms', () => {
  it('busca el SKU con y sin guion, sin distinguir tildes', () => {
    const terms = foldedOrderSearchTerms('RM-489');
    expect(terms?.skus).toEqual(expect.arrayContaining(['rm-489', 'rm489']));
    expect(foldedOrderSearchTerms('CÁRTIER')?.folded).toBe('cartier');
    expect(foldedOrderSearchTerms('Cartier')?.folded).toBe(foldedOrderSearchTerms('cártier')?.folded);
  });

  it('ignora un término vacío', () => {
    expect(foldedOrderSearchTerms('   ')).toBeNull();
  });
});
