import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateSpecialSaleDto } from './special-sale.dto';

function dto(body: Record<string, unknown>) {
  return plainToInstance(CreateSpecialSaleDto, body);
}

describe('CreateSpecialSaleDto', () => {
  const valid = {
    watchId: 'watch-1',
    salePrice: 30000,
    note: 'mamá de Álvaro',
  };

  it('acepta precio mayor a 0 y nota', async () => {
    const errors = await validate(dto(valid));
    expect(errors).toHaveLength(0);
  });

  it('exige el precio de venta', async () => {
    const errors = await validate(dto({ ...valid, salePrice: undefined }));
    expect(errors.some((error) => error.property === 'salePrice')).toBe(true);
  });

  it('rechaza precio 0', async () => {
    const errors = await validate(dto({ ...valid, salePrice: 0 }));
    expect(errors.some((error) => error.property === 'salePrice')).toBe(true);
  });

  it('exige la nota', async () => {
    const errors = await validate(dto({ ...valid, note: '   ' }));
    expect(errors.some((error) => error.property === 'note')).toBe(true);
  });
});
