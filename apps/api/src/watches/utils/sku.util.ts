import { createHash } from 'crypto';

export function generateSku(brandName: string, reference: string | undefined | null): string {
  const brandCode = brandName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');

  const refTail = reference
    ? reference.replace(/[^a-zA-Z0-9]/g, '').slice(-3).padStart(3, '0')
    : Math.floor(100 + Math.random() * 900).toString();

  const shortHash = createHash('md5')
    .update(`${brandName}-${reference ?? Date.now()}-${Math.random()}`)
    .digest('hex')
    .slice(0, 3)
    .toUpperCase();

  return `LUX-${brandCode}-${refTail}-${shortHash}`;
}
