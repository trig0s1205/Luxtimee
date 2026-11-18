import type { Prisma } from '@prisma/client';
import { RECEIPT_PREFIX } from './receipt-number.util';

/** Normaliza "123" / "000123" / "LXT-000123" → "LXT-000123". */
export function normalizeReceiptNumberQuery(q: string): string | null {
  const raw = q.trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) return null;
  let digits: string | null = null;
  if (raw.startsWith(RECEIPT_PREFIX)) {
    const rest = raw.slice(RECEIPT_PREFIX.length);
    if (/^\d+$/.test(rest)) digits = rest;
  } else if (/^\d+$/.test(raw)) {
    digits = raw;
  }
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return `${RECEIPT_PREFIX}${String(n).padStart(6, '0')}`;
}

export function buildReceiptSearchWhere(q: string): Prisma.SaleReceiptWhereInput {
  const term = q.trim();
  if (!term) return { id: '__none__' };

  const ors: Prisma.SaleReceiptWhereInput[] = [
    { orderReadableId: { contains: term, mode: 'insensitive' } },
    { customerName: { contains: term, mode: 'insensitive' } },
    { customerDocument: { contains: term, mode: 'insensitive' } },
    {
      items: {
        some: { sku: { contains: term, mode: 'insensitive' } },
      },
    },
    { number: { contains: term, mode: 'insensitive' } },
  ];

  const normalized = normalizeReceiptNumberQuery(term);
  if (normalized) {
    ors.push({ number: normalized });
  }

  const phoneDigits = term.replace(/\D/g, '');
  if (phoneDigits.length > 0) {
    ors.push({ customerPhone: { contains: phoneDigits } });
  }

  return { OR: ors };
}
