import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePosSaleDto, PosCatalogQueryDto } from './dto/pos.dto';

describe('POS DTOs', () => {
  it('rechaza serial, unitPrice o discount en ítems', async () => {
    const dto = plainToInstance(CreatePosSaleDto, {
      customer: { name: 'Ana' },
      items: [
        {
          watchId: 'w1',
          quantity: 1,
          serial: 'ABC',
          unitPrice: 1,
          discount: 10,
        },
      ],
      payments: [{ method: 'EFECTIVO', amount: 1, cashReceived: 1 }],
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('limit 100 en catálogo es inválido', async () => {
    const dto = plainToInstance(PosCatalogQueryDto, { limit: 100 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
