import { createHash } from 'crypto';
import { hashWholesaleToken } from './wholesale-token';

describe('wholesale token hash', () => {
  it('es sha256 hex utf8 y no conserva el token', () => {
    const token = 'abc123enlace';
    const hash = hashWholesaleToken(token);
    expect(hash).toBe(createHash('sha256').update(token, 'utf8').digest('hex'));
    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
