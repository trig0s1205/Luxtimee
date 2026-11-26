import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { PrismaClient, Role } from '@prisma/client';
import {
  encodePngImage,
  fingerprintImageBytes,
  type ImageDuplicateMatch,
} from '@luxtime/shared';
import request from 'supertest';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MemoryCacheService } from '../common/cache/memory-cache.service';
import { ImageProcessingService } from '../integrations/image-processing.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { runImageFingerprintBackfill } from './backfill-image-fingerprints';
import { assertLocalDatabaseUrl } from './local-database';
import { WatchesController } from './watches.controller';
import { WatchesRepository } from './watches.repository';
import { WatchesService } from './watches.service';

jest.setTimeout(60_000);

const SECRET = 'image-duplicate-test-secret';
const prefix = `dup${Date.now().toString(36)}`;

function assertSafeDatabase() {
  const url = process.env.DATABASE_URL;
  assertLocalDatabaseUrl(url);
}

describe('coincidencias de fotos', () => {
  const prisma = new PrismaClient();
  let app: INestApplication;
  let token = '';
  let brandId = '';
  let watchId = '';
  const png = encodePngImage(face(96, 128), 96, 128);

  beforeAll(async () => {
    assertSafeDatabase();
    process.env.JWT_SECRET = SECRET;
    await prisma.$connect();
    const brand = await prisma.brand.create({
      data: { name: `Marca ${prefix}`, slug: prefix },
    });
    brandId = brand.id;
    const user = await prisma.user.create({
      data: {
        email: `${prefix}@test.local`,
        name: 'Secretaria',
        role: Role.ADMIN,
        passwordHash: 'x',
        tokenVersion: 3,
      },
    });
    const watch = await prisma.watch.create({
      data: {
        sku: `${prefix}-SKU`,
        slug: `${prefix}-reloj`,
        brandId,
        model: 'Submariner',
        movementType: 'Automático',
        functions: [],
        retailPrice: 0,
        wholesalePrice: 0,
        stock: 0,
        status: 'AGOTADO',
        isPublished: false,
        isActive: true,
        frontImageUrl: `/uploads/watches/${prefix}.png`,
        images: [`/uploads/watches/${prefix}.png`],
      },
    });
    watchId = watch.id;
    const fingerprint = await fingerprintImageBytes(png);
    await prisma.watchImageFingerprint.create({
      data: {
        watchId,
        imageUrl: `/uploads/watches/${prefix}.png`,
        slot: 'front',
        contentHash: fingerprint.contentHash,
        perceptualHash: fingerprint.perceptualHash,
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({
            JWT_SECRET: SECRET,
            NODE_ENV: 'test',
            USE_MOCKS: 'true',
          })],
        }),
        JwtModule.register({ secret: SECRET }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
      ],
      controllers: [WatchesController],
      providers: [
        WatchesService,
        WatchesRepository,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        {
          provide: SettingsService,
          useValue: { getCommissionConfig: async () => ({ percent: 5 }) },
        },
        {
          provide: ImageProcessingService,
          useValue: {
            processWithMicroservice: async (file: Express.Multer.File) => file.buffer,
            uploadToCloudinary: async () => 'https://res.cloudinary.com/mock/image/upload/x.webp',
            deleteCloudinaryAsset: async () => undefined,
          },
        },
        { provide: MemoryCacheService, useValue: { invalidateTag: () => undefined } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    await app.init();
    token = moduleRef.get(JwtService).sign({
      sub: user.id,
      email: user.email,
      role: Role.ADMIN,
      typ: 'access',
      tv: 3,
    });
  });

  afterAll(async () => {
    await app?.close();
    await prisma.watch.deleteMany({ where: { sku: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { email: `${prefix}@test.local` } });
    if (brandId) await prisma.brand.delete({ where: { id: brandId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  function server() {
    return app.getHttpServer();
  }

  it('exige sesión de admin', async () => {
    await request(server())
      .post('/api/v1/watches/image-duplicates')
      .send({ items: [{ id: 'a', contentHash: 'ab'.repeat(32), perceptualHash: '0'.repeat(16) }] })
      .expect(401);
  });

  it('devuelve el reloj borrador cuando la foto es la misma o parecida, y no cuando es otra', async () => {
    const exact = await fingerprintImageBytes(png);
    const resized = encodePngImage(nearest(face(96, 128), 96, 128, 48, 64), 48, 64);
    const near = await fingerprintImageBytes(resized);
    const other = await fingerprintImageBytes(encodePngImage(face(96, 128, true), 96, 128, 0));

    const response = await request(server())
      .post('/api/v1/watches/image-duplicates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { id: 'exacta', contentHash: exact.contentHash, perceptualHash: exact.perceptualHash },
          { id: 'parecida', contentHash: near.contentHash, perceptualHash: near.perceptualHash },
          { id: 'otra', contentHash: other.contentHash, perceptualHash: other.perceptualHash },
        ],
      })
      .expect(200);

    const matches = response.body.matches as ImageDuplicateMatch[];
    const byId = new Map(matches.map((match) => [match.id, match.duplicates]));
    expect(byId.get('exacta')?.[0]).toMatchObject({
      watchId,
      sku: `${prefix}-SKU`,
      model: 'Submariner',
      slot: 'front',
      kind: 'exact',
    });
    expect(byId.get('parecida')?.length).toBeGreaterThan(0);
    expect(byId.get('otra')).toEqual([]);
  });

  it('al subir la foto guarda la huella que luego coincide', async () => {
    const created = await prisma.watch.create({
      data: {
        sku: `${prefix}-nuevo`,
        slug: `${prefix}-nuevo`,
        brandId,
        model: 'Pendiente',
        movementType: 'Automático',
        functions: [],
        retailPrice: 0,
        wholesalePrice: 0,
        stock: 0,
        status: 'AGOTADO',
        isPublished: false,
      },
    });
    const service = app.get(WatchesService);
    await service.uploadMedia(created.id, {
      image1: {
        buffer: Buffer.from(png),
        originalname: 'frente.png',
        mimetype: 'image/png',
        size: png.length,
        fieldname: 'image1',
      } as Express.Multer.File,
    }, 'http://127.0.0.1:3001');

    const row = await prisma.watchImageFingerprint.findFirst({
      where: { watchId: created.id, slot: 'front' },
    });
    const expected = await fingerprintImageBytes(png);
    expect(row?.contentHash).toBe(expected.contentHash);
    expect(row?.perceptualHash).toBe(expected.perceptualHash);

    const found = await request(server())
      .post('/api/v1/watches/image-duplicates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          id: 'subida',
          contentHash: expected.contentHash,
          perceptualHash: expected.perceptualHash,
        }],
      })
      .expect(200);
    const hits = (found.body.matches as ImageDuplicateMatch[])[0].duplicates;
    expect(hits.some((hit) => hit.watchId === created.id && hit.kind === 'exact')).toBe(true);
  });

  it('el backfill es idempotente y no descarga urls remotas', async () => {
    const url = `/uploads/watches/${prefix}-backfill.png`;
    const watch = await prisma.watch.create({
      data: {
        sku: `${prefix}-bf`,
        slug: `${prefix}-bf`,
        brandId,
        model: 'Backfill',
        movementType: 'Automático',
        functions: [],
        retailPrice: 1,
        wholesalePrice: 1,
        stock: 0,
        status: 'AGOTADO',
        isPublished: false,
        frontImageUrl: url,
        images: [url, 'https://res.cloudinary.com/mock/image/upload/lejos.webp'],
      },
    });
    const bytes = new Map<string, Uint8Array>([[url, png]]);
    const dry = await runImageFingerprintBackfill({
      prisma,
      apply: false,
      readBytes: async (imageUrl) => bytes.get(imageUrl) ?? null,
    });
    expect(dry.pending).toBeGreaterThanOrEqual(2);
    expect(dry.updated).toBe(0);
    const first = await runImageFingerprintBackfill({
      prisma,
      apply: true,
      readBytes: async (imageUrl) => bytes.get(imageUrl) ?? null,
    });
    expect(first.updated).toBeGreaterThanOrEqual(1);
    expect(first.remoteSkipped).toBeGreaterThanOrEqual(1);
    const again = await runImageFingerprintBackfill({
      prisma,
      apply: true,
      readBytes: async () => {
        throw new Error('no debería releer');
      },
    });
    expect(again.updated).toBe(0);
    const saved = await prisma.watchImageFingerprint.findFirst({
      where: { watchId: watch.id, imageUrl: url },
    });
    expect(saved?.contentHash).toHaveLength(64);
  });
});

function face(width: number, height: number, other = false) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      let value = Math.round((x / Math.max(1, width - 1)) * 220) + 15;
      if (other) {
        const column = Math.floor((x / width) * 4);
        const row = Math.floor((y / height) * 4);
        value = (column + row) % 2 === 0 ? 16 : 230;
      }
      rgba[index] = value;
      rgba[index + 1] = value;
      rgba[index + 2] = value;
      rgba[index + 3] = 255;
    }
  }
  return rgba;
}

function nearest(src: Uint8Array, sw: number, sh: number, dw: number, dh: number) {
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const sy = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / dh));
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / dw));
      out.set(src.subarray((sy * sw + sx) * 4, (sy * sw + sx) * 4 + 4), (y * dw + x) * 4);
    }
  }
  return out;
}
