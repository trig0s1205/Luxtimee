import { PrismaClient } from '@prisma/client';
import { runImageFingerprintBackfill } from '../watches/backfill-image-fingerprints';
import {
  assertProductionApplyAllowed,
  isAllowedCloudinaryImageUrl,
} from './fingerprint-backfill-prod';

describe('filtro de host Cloudinary', () => {
  const cloud = 'cdn.luxtimee.com';

  it('acepta https de res.cloudinary.com y del host configurado', () => {
    expect(
      isAllowedCloudinaryImageUrl(
        'https://res.cloudinary.com/demo/image/upload/v1/a.jpg',
        'demo',
      ),
    ).toBe(true);
    expect(
      isAllowedCloudinaryImageUrl('https://cdn.luxtimee.com/foto.jpg', cloud),
    ).toBe(true);
    expect(
      isAllowedCloudinaryImageUrl(
        'https://img.cdn.luxtimee.com/foto.jpg',
        cloud,
      ),
    ).toBe(true);
  });

  it('rechaza http, otros hosts y urls rotas', () => {
    expect(
      isAllowedCloudinaryImageUrl(
        'http://res.cloudinary.com/demo/image/upload/a.jpg',
        'demo',
      ),
    ).toBe(false);
    expect(
      isAllowedCloudinaryImageUrl('https://evil.example/a.jpg', 'demo'),
    ).toBe(false);
    expect(isAllowedCloudinaryImageUrl('/uploads/a.jpg', 'demo')).toBe(false);
    expect(isAllowedCloudinaryImageUrl('no-es-url', 'demo')).toBe(false);
  });
});

describe('CONFIRM_PROD_FINGERPRINTS', () => {
  it('el dry-run no exige la variable', () => {
    expect(() => assertProductionApplyAllowed(false, undefined)).not.toThrow();
  });

  it('apply sin SI falla', () => {
    expect(() => assertProductionApplyAllowed(true, undefined)).toThrow(
      /CONFIRM_PROD_FINGERPRINTS=SI/,
    );
    expect(() => assertProductionApplyAllowed(true, 'si')).toThrow(
      /CONFIRM_PROD_FINGERPRINTS=SI/,
    );
  });

  it('apply con SI pasa', () => {
    expect(() => assertProductionApplyAllowed(true, 'SI')).not.toThrow();
  });
});

describe('dry-run de huellas', () => {
  it('no escribe ni pide bytes', async () => {
    const upsert = jest.fn();
    const readBytes = jest.fn();
    const prisma = {
      watch: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'w1',
            images: ['https://res.cloudinary.com/demo/image/upload/a.jpg'],
            frontImageUrl: 'https://res.cloudinary.com/demo/image/upload/a.jpg',
            backImageUrl: null,
            primaryImageUrl: null,
            secondaryImageUrl: null,
            imageFingerprints: [],
          },
        ]),
      },
      watchImageFingerprint: { upsert },
    } as unknown as PrismaClient;

    const summary = await runImageFingerprintBackfill({
      prisma,
      apply: false,
      allowRemoteImages: true,
      readBytes,
    });

    expect(summary.pending).toBeGreaterThan(0);
    expect(summary.updated).toBe(0);
    expect(summary.failed).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
    expect(readBytes).not.toHaveBeenCalled();
  });
});
