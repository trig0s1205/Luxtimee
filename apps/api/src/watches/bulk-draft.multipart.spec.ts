import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolesGuard } from '../common/guards/roles.guard';
import { WatchesController } from './watches.controller';
import { WatchesService } from './watches.service';

describe('POST /watches/bulk-draft multipart', () => {
  let app: INestApplication;
  const createBulkDraft = jest.fn().mockResolvedValue({ id: 'watch-1', reused: false });
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WatchesController],
      providers: [{ provide: WatchesService, useValue: { createBulkDraft } }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    createBulkDraft.mockClear();
  });

  it('no rechaza image1/image2 ni un MIME octet-stream bajo el pipe global', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/watches/bulk-draft')
      .attach('image1', jpeg, { filename: 'frente.jpg', contentType: 'application/octet-stream' })
      .attach('image2', jpeg, { filename: 'dorso.jpg', contentType: 'application/octet-stream' })
      .field('idempotencyKey', 'batch-1:frente.jpg|dorso.jpg')
      .expect(201);

    expect(createBulkDraft).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'batch-1:frente.jpg|dorso.jpg',
    }));
    const body = createBulkDraft.mock.calls[0][0] as {
      image1: { mimetype: string };
      image2: { mimetype: string };
    };
    expect(body.image1.mimetype).toBe('application/octet-stream');
    expect(body.image2.mimetype).toBe('application/octet-stream');
  });
});
