import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma, Role } from '@prisma/client';
import { validate } from 'class-validator';
import { planPhotoPairs } from '@luxtime/shared';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { RolesGuard } from '../common/guards/roles.guard';
import { BulkDraftWatchDto } from './dto/bulk-draft-watch.dto';
import { WatchesController } from './watches.controller';
import { WatchesRepository } from './watches.repository';
import { WatchesService } from './watches.service';
import {
  BULK_DRAFT_THROTTLE,
  BULK_DRAFT_UPLOAD_LIMITS,
} from './utils/bulk-draft.util';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
}));

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function image(name: string, buffer = jpeg, mimetype = 'image/jpeg') {
  return {
    originalname: name,
    mimetype,
    buffer,
    size: buffer.length,
  } as Express.Multer.File;
}

function serviceWith(repo: Record<string, jest.Mock>, images?: Record<string, jest.Mock>) {
  const imageProcessing = {
    processWithMicroservice: jest.fn(async (file: Express.Multer.File) => file.buffer),
    uploadToCloudinary: jest.fn(),
    deleteCloudinaryAsset: jest.fn().mockResolvedValue(undefined),
    ...images,
  };
  const service = new WatchesService(
    repo as never,
    { getCommissionConfig: jest.fn().mockResolvedValue({ percent: 0 }) } as never,
    imageProcessing as never,
    { invalidateTag: jest.fn() } as never,
  );
  return { service, imageProcessing };
}

describe('planPhotoPairs', () => {
  const file = (name: string, size = 100, mime = 'image/jpeg') => ({ name, size, mime });

  it('ordena por nombre natural y empareja impar/par', () => {
    const planned = planPhotoPairs(
      [file('010.jpg'), file('002.jpg'), file('001.jpg'), file('003.jpg')],
      'batch-1',
    );
    expect(planned.errors).toEqual([]);
    expect(planned.pairs.map((pair) => [pair.front.name, pair.back.name])).toEqual([
      ['001.jpg', '002.jpg'],
      ['003.jpg', '010.jpg'],
    ]);
    expect(planned.pairs[0]?.idempotencyKey).toBe('batch-1:001.jpg|002.jpg');
  });

  it('reporta cantidad impar, tipo y peso con el nombre del archivo', () => {
    const odd = planPhotoPairs([file('001.jpg'), file('002.jpg'), file('003.jpg')], 'b');
    expect(odd.errors.some((error) => error.fileName === '003.jpg' && error.message.includes('par'))).toBe(true);

    const kind = planPhotoPairs([file('001.jpg'), file('notas.txt', 10, 'text/plain')], 'b');
    expect(kind.errors.some((error) => error.fileName === 'notas.txt')).toBe(true);

    const heavy = planPhotoPairs([file('001.jpg'), file('002.jpg', 11 * 1024 * 1024)], 'b', 10 * 1024 * 1024);
    expect(heavy.errors.some((error) => error.fileName === '002.jpg' && error.message.includes('10 MB'))).toBe(true);
    expect(heavy.pairs).toEqual([]);
  });

  it('rechaza más de 500 fotos', () => {
    const files = Array.from({ length: 501 }, (_, index) => file(`${index}.jpg`));
    const planned = planPhotoPairs(files, 'b');
    expect(planned.pairs).toEqual([]);
    expect(planned.errors.some((error) => error.message.includes('500'))).toBe(true);
  });
});

describe('bulk-draft guard y límites', () => {
  it('solo Super Admin pasa el guard', () => {
    const guard = new RolesGuard(new Reflector());
    const context = (role: Role) => ({
      getClass: () => WatchesController,
      getHandler: () => WatchesController.prototype.bulkDraft,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    });
    expect(() => guard.canActivate(context(Role.ADMIN) as never)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context(Role.CUSTOMER) as never)).toThrow(ForbiddenException);
    expect(guard.canActivate(context(Role.SUPER_ADMIN) as never)).toBe(true);
  });

  it('tiene throttle propio y límite de multer', () => {
    expect(BULK_DRAFT_THROTTLE.default.limit).toBe(60);
    expect(BULK_DRAFT_THROTTLE.default.ttl).toBe(60_000);
    expect(BULK_DRAFT_UPLOAD_LIMITS).toEqual({
      fileSize: 10 * 1024 * 1024,
      files: 2,
    });
  });

  it('valida la clave de idempotencia', async () => {
    const dto = new BulkDraftWatchDto();
    dto.idempotencyKey = 'corta';
    expect((await validate(dto)).length).toBeGreaterThan(0);
    dto.idempotencyKey = 'batch-1:001.jpg|002.jpg';
    expect(await validate(dto)).toEqual([]);
  });
});

describe('WatchesService.createBulkDraft', () => {
  const key = 'batch-1:001.jpg|002.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
    (writeFile as jest.Mock).mockResolvedValue(undefined);
    (mkdir as jest.Mock).mockResolvedValue(undefined);
    (unlink as jest.Mock).mockResolvedValue(undefined);
  });

  it('rechaza a quien no es Super Admin', async () => {
    const repo = { findByBulkDraftKey: jest.fn() };
    const { service } = serviceWith(repo);
    await expect(
      service.createBulkDraft(
        { image1: image('001.jpg'), image2: image('002.jpg'), idempotencyKey: key },
        Role.ADMIN,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.findByBulkDraftKey).not.toHaveBeenCalled();
  });

  it('nombra el archivo cuando la imagen no es válida', async () => {
    const repo = { findByBulkDraftKey: jest.fn() };
    const { service } = serviceWith(repo);
    await expect(
      service.createBulkDraft(
        {
          image1: image('001.jpg'),
          image2: image('malo.png', Buffer.from('no-es-imagen'), 'image/png'),
          idempotencyKey: key,
        },
        Role.SUPER_ADMIN,
      ),
    ).rejects.toThrow(/malo\.png/);
  });

  it('devuelve el borrador existente sin volver a subir fotos', async () => {
    const existing = { id: 'watch-1', sku: 'RM-001' };
    const repo = {
      findByBulkDraftKey: jest.fn().mockResolvedValue(existing),
      createBulkDraftOnce: jest.fn(),
    };
    const { service, imageProcessing } = serviceWith(repo);
    const result = await service.createBulkDraft(
      { image1: image('001.jpg'), image2: image('002.jpg'), idempotencyKey: key },
      Role.SUPER_ADMIN,
    );
    expect(result).toMatchObject({ id: 'watch-1', reused: true });
    expect(imageProcessing.processWithMicroservice).not.toHaveBeenCalled();
    expect(repo.createBulkDraftOnce).not.toHaveBeenCalled();
  });

  it('si la segunda foto no se guarda, no crea el reloj y borra la primera', async () => {
    let writes = 0;
    (writeFile as jest.Mock).mockImplementation(async () => {
      writes += 1;
      if (writes > 1) throw new Error('disco lleno');
    });
    const repo = {
      findByBulkDraftKey: jest.fn().mockResolvedValue(null),
      findFirstBrandId: jest.fn().mockResolvedValue('brand-1'),
      brandExists: jest.fn().mockResolvedValue(true),
      findBySlug: jest.fn().mockResolvedValue(null),
      createBulkDraftOnce: jest.fn(),
    };
    const { service } = serviceWith(repo);
    await expect(
      service.createBulkDraft(
        { image1: image('001.jpg'), image2: image('002.jpg'), idempotencyKey: key },
        Role.SUPER_ADMIN,
      ),
    ).rejects.toThrow('disco lleno');
    expect(repo.createBulkDraftOnce).not.toHaveBeenCalled();
    expect(unlink).toHaveBeenCalled();
  });

  it('si la subida a Cloudinary falla, borra la foto ya subida', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const repo = {
        findByBulkDraftKey: jest.fn().mockResolvedValue(null),
        findFirstBrandId: jest.fn().mockResolvedValue('brand-1'),
        brandExists: jest.fn().mockResolvedValue(true),
        findBySlug: jest.fn().mockResolvedValue(null),
        createBulkDraftOnce: jest.fn(),
      };
      const { service, imageProcessing } = serviceWith(repo, {
        uploadToCloudinary: jest
          .fn()
          .mockResolvedValueOnce(
            'https://res.cloudinary.com/demo/image/upload/v1/folder/a.webp',
          )
          .mockRejectedValue(new Error('cloudinary caído')),
      });
      await expect(
        service.createBulkDraft(
          { image1: image('001.jpg'), image2: image('002.jpg'), idempotencyKey: key },
          Role.SUPER_ADMIN,
        ),
      ).rejects.toThrow('cloudinary caído');
      expect(repo.createBulkDraftOnce).not.toHaveBeenCalled();
      expect(imageProcessing.deleteCloudinaryAsset).toHaveBeenCalledWith(
        'https://res.cloudinary.com/demo/image/upload/v1/folder/a.webp',
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('reutiliza la clave si otro request ya creó el borrador', async () => {
    const repo = {
      findByBulkDraftKey: jest.fn().mockResolvedValue(null),
      findFirstBrandId: jest.fn().mockResolvedValue('brand-1'),
      brandExists: jest.fn().mockResolvedValue(true),
      findBySlug: jest.fn().mockResolvedValue(null),
      createBulkDraftOnce: jest.fn().mockResolvedValue({
        created: false,
        watch: { id: 'watch-2', sku: 'RM-004' },
      }),
    };
    const { service } = serviceWith(repo);
    const result = await service.createBulkDraft(
      { image1: image('001.jpg'), image2: image('002.jpg'), idempotencyKey: key },
      Role.SUPER_ADMIN,
    );
    expect(result).toMatchObject({ id: 'watch-2', reused: true });
    expect(unlink).toHaveBeenCalled();
  });
});

describe('WatchesRepository SKU e idempotencia', () => {
  function repository(create: jest.Mock, findFirst: jest.Mock) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      watch: {
        findMany: jest.fn().mockResolvedValue([
          { sku: 'RM-001' },
          { sku: 'RM-010' },
          { sku: 'RM-010-OLD' },
        ]),
        findFirst,
        create,
      },
    };
    const prisma = {
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    return { repo: new WatchesRepository(prisma as never), tx };
  }

  it('asigna el siguiente SKU dentro de la transacción', async () => {
    const create = jest.fn(async ({ data }: { data: { sku: string } }) => ({
      id: 'w',
      sku: data.sku,
    }));
    const { repo } = repository(create, jest.fn().mockResolvedValue(null));
    const watch = await repo.createAllocatingSku(
      { model: 'A' } as never,
      0,
      null,
    );
    expect(watch.sku).toBe('RM-011');
  });

  it('reintenta si el SKU choca con la restricción única', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['sku'] },
    });
    const create = jest
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async ({ data }: { data: { sku: string } }) => ({
        id: 'w2',
        sku: data.sku,
      }));
    const { repo } = repository(create, jest.fn().mockResolvedValue(null));
    const watch = await repo.createAllocatingSku({ model: 'A' } as never, 0, null);
    expect(create).toHaveBeenCalledTimes(2);
    expect(watch.id).toBe('w2');
  });

  it('no crea otro reloj si la clave ya existe', async () => {
    const create = jest.fn();
    const existing = { id: 'ya', sku: 'RM-003' };
    const { repo } = repository(create, jest.fn().mockResolvedValue(existing));
    const result = await repo.createBulkDraftOnce({
      idempotencyKey: 'batch-1:001.jpg|002.jpg',
      retailPrice: 0,
      gender: null,
      data: { model: 'Pendiente de completar' } as never,
    });
    expect(result).toEqual({ watch: existing, created: false });
    expect(create).not.toHaveBeenCalled();
  });
});
