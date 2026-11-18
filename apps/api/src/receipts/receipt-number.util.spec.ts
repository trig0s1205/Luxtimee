import { formatReceiptNumber } from './receipt-number.util';

describe('formatReceiptNumber', () => {
  it('rellena a 6 dígitos', () => {
    expect(formatReceiptNumber(1)).toBe('LXT-000001');
    expect(formatReceiptNumber(123)).toBe('LXT-000123');
  });

  it('permite más de 6 dígitos sin truncar', () => {
    expect(formatReceiptNumber(1234567)).toBe('LXT-1234567');
  });

  it('rechaza valores inválidos', () => {
    expect(() => formatReceiptNumber(0)).toThrow();
    expect(() => formatReceiptNumber(-1)).toThrow();
    expect(() => formatReceiptNumber(1.5)).toThrow();
  });
});
