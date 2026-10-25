import { readJwtSecret, readTokenDuration } from './jwt-config';

describe('jwt config', () => {
  it('recorta el secreto para que firmar y verificar usen el mismo valor', () => {
    expect(readJwtSecret('  secreto\n')).toBe('secreto');
    expect(() => readJwtSecret(' \n')).toThrow('JWT_SECRET');
  });

  it('un número pelado son segundos, no milisegundos', () => {
    expect(readTokenDuration('900', '15m')).toEqual({ expiresIn: '900s', maxAgeMs: 900_000 });
  });

  it('recorta 15m y cae al fallback si el valor no es una duración', () => {
    expect(readTokenDuration(' 15m\n', '15m').expiresIn).toBe('15m');
    expect(readTokenDuration('luego', '15m')).toEqual({
      expiresIn: '15m',
      maxAgeMs: 15 * 60 * 1000,
    });
  });
});