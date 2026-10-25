import { createHash, randomBytes } from 'crypto';

export function hashWholesaleToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateWholesaleToken() {
  return randomBytes(24).toString('hex');
}
