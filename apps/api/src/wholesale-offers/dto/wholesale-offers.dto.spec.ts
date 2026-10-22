import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  UpdateWholesalePackageDto,
  UpsertWholesalePackageDto,
} from './wholesale-offers.dto';

const base = {
  name: 'Pack',
  minQuantity: 10,
  unitPrice: 1000,
};

describe('UpsertWholesalePackageDto', () => {
  it('acepta null y una fecha ISO', async () => {
    const dto = plainToInstance(UpsertWholesalePackageDto, {
      ...base,
      startsAt: null,
      endsAt: '2026-10-22T12:00:00.000Z',
      watchIds: ['reloj-1'],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza una fecha que no es ISO8601', async () => {
    const dto = plainToInstance(UpsertWholesalePackageDto, {
      ...base,
      startsAt: 'mañana',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'startsAt')).toBe(true);
  });

  it('rechaza más de 500 relojes', async () => {
    const dto = plainToInstance(UpsertWholesalePackageDto, {
      ...base,
      watchIds: Array.from({ length: 501 }, (_, index) => `id-${index}`),
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'watchIds')).toBe(true);
  });
});

describe('UpdateWholesalePackageDto', () => {
  it('permite omitir fechas y aceptar null', async () => {
    const empty = plainToInstance(UpdateWholesalePackageDto, {});
    expect(await validate(empty)).toHaveLength(0);
    const cleared = plainToInstance(UpdateWholesalePackageDto, {
      startsAt: null,
      endsAt: null,
    });
    expect(await validate(cleared)).toHaveLength(0);
  });
});
