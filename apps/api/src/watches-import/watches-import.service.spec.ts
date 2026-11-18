import { Role } from '@prisma/client';
import { WatchesImportService } from './watches-import.service';
import { IMPORT_KEY_FIELD } from './import.constants';

function csvMulter(content: string): Express.Multer.File {
  const buffer = Buffer.from(content, 'utf8');
  return {
    fieldname: 'file',
    originalname: 'relojes.csv',
    encoding: '7bit',
    mimetype: 'text/csv',
    size: buffer.length,
    buffer,
    destination: '',
    filename: 'relojes.csv',
    path: '',
    stream: null as unknown as Express.Multer.File['stream'],
  };
}

const HEADER =
  '_fila,importKey,brand,model,reference,category,gender,mechanism,retailPrice,wholesalePrice,cost,stock,warrantyMonths,description,dialColor,caseDiameter,caseMaterial,bezelMaterial,crystalType,strapMaterial,waterResistance,movementCaliber,functions,careTemplate,isLimitedEdition,limitedEditionNumber';

describe('WatchesImportService', () => {
  const prisma = {
    brand: {
      findMany: jest.fn(async () => [{ id: 'b1', name: 'Rolex' }]),
    },
    category: {
      findMany: jest.fn(async () => [{ id: 'c1', name: 'Deportivo' }]),
    },
    mechanism: {
      findMany: jest.fn(async () => [{ id: 'm1', name: 'Automático' }]),
    },
    careTemplate: { findMany: jest.fn(async () => []) },
    watch: {
      findMany: jest.fn(async () => []),
    },
  };

  const watchesService = {
    create: jest.fn(async (dto: { specs?: Record<string, string> }) => ({
      id: 'w1',
      sku: 'RM-001',
      specs: dto.specs,
    })),
  };

  let service: WatchesImportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WatchesImportService(
      prisma as never,
      watchesService as never,
    );
  });

  it('ignora fila EJEMPLO y valida fila ok', async () => {
    const csv = [
      'es',
      HEADER,
      'EJEMPLO,000,Rolex,Ejemplo,,Deportivo,Hombre,Automático,1,1,,0,12,,,,,,,',
      ',001,Rolex,Sub,,Deportivo,Hombre,Automático,5000000,4000000,100,1,12,Bonito,,,,,,,',
    ].join('\n');
    const preview = await service.preview(csvMulter(csv), Role.SUPER_ADMIN);
    expect(preview.summary.ejemplo).toBe(1);
    expect(preview.summary.ok).toBe(1);
    expect(preview.rows.find((r) => r.importKey === '001')?.skuPrefixEstimado).toBe(
      'RP',
    );
  });

  it('marca duplicados de importKey en el archivo', async () => {
    const csv = [
      'es',
      HEADER,
      ',001,Rolex,A,,Deportivo,Hombre,Automático,100000,90000,,1,12,d,,,,,,,',
      ',001,Rolex,B,,Deportivo,Hombre,Automático,100000,90000,,1,12,d,,,,,,,',
    ].join('\n');
    const preview = await service.preview(csvMulter(csv), Role.ADMIN);
    expect(preview.rows.filter((r) => r.status === 'error').length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('ignora cost para ADMIN con advertencia', async () => {
    const csv = [
      'es',
      HEADER,
      ',003,Rolex,X,,Deportivo,Hombre,Automático,100000,90000,99999,1,12,d,,,,,,,',
    ].join('\n');
    const preview = await service.preview(csvMulter(csv), Role.ADMIN);
    const row = preview.rows[0];
    expect(row.warnings.some((w) => w.field === 'cost')).toBe(true);
    expect(row.normalized.cost).toBeUndefined();
  });

  it('preview no llama a create', async () => {
    const csv = [
      'es',
      HEADER,
      ',004,Rolex,Y,,Deportivo,Hombre,Automático,100000,90000,,1,12,d,,,,,,,',
    ].join('\n');
    await service.preview(csvMulter(csv), Role.ADMIN);
    expect(watchesService.create).not.toHaveBeenCalled();
  });

  it('commit omite ya-importado', async () => {
    prisma.watch.findMany.mockResolvedValueOnce([
      { specs: { [IMPORT_KEY_FIELD]: '005' } },
    ]);
    const csv = [
      'es',
      HEADER,
      ',005,Rolex,Z,,Deportivo,Hombre,Automático,100000,90000,,1,12,d,,,,,,,',
    ].join('\n');
    const result = await service.commit(csvMulter(csv), Role.ADMIN, true);
    expect(result[0].error).toBe('ya-importado');
    expect(watchesService.create).not.toHaveBeenCalled();
  });
});
