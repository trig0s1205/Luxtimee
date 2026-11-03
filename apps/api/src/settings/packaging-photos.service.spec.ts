import { MAX_PACKAGING_PHOTOS } from '@luxtime/shared';
import { PackagingPhotosService } from './packaging-photos.service';

type Row = {
  id: string;
  imageUrl: string;
  caption: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

function createHarness() {
  const rows: Row[] = [];
  let seq = 0;
  const deleted: string[] = [];
  const uploaded: string[] = [];
  const invalidateTag = jest.fn();

  const prisma = {
    packagingPhoto: {
      findMany: async (args?: { select?: { id: true } }) => {
        const sorted = [...rows].sort(
          (a, b) =>
            a.sortOrder - b.sortOrder ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        );
        if (args?.select) return sorted.map((row) => ({ id: row.id }));
        return sorted;
      },
      count: async () => rows.length,
      aggregate: async () => ({
        _max: {
          sortOrder: rows.length
            ? Math.max(...rows.map((row) => row.sortOrder))
            : null,
        },
      }),
      create: async ({
        data,
      }: {
        data: { imageUrl: string; sortOrder: number; caption?: string | null };
      }) => {
        const row: Row = {
          id: `photo${++seq}`,
          imageUrl: data.imageUrl,
          caption: data.caption ?? null,
          sortOrder: data.sortOrder,
          createdAt: new Date(Date.now() + seq),
          updatedAt: new Date(Date.now() + seq),
        };
        rows.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        rows.find((row) => row.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Pick<Row, 'caption' | 'sortOrder'>>;
      }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) throw new Error('missing');
        if (data.caption !== undefined) row.caption = data.caption;
        if (data.sortOrder !== undefined) row.sortOrder = data.sortOrder;
        row.updatedAt = new Date();
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = rows.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error('missing');
        const [row] = rows.splice(index, 1);
        return row;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  const service = new PackagingPhotosService(
    prisma as never,
    { invalidateTag } as never,
    {
      uploadHomepageImage: async () => {
        const url = `https://res.cloudinary.com/demo/image/upload/v1/luxtime/homepage/packaging-${uploaded.length}.jpg`;
        uploaded.push(url);
        return url;
      },
      deleteCloudinaryAsset: async (url: string) => {
        deleted.push(url);
      },
    } as never,
  );

  return { service, rows, deleted, uploaded, invalidateTag };
}

function file(): Express.Multer.File {
  return { buffer: Buffer.from('img') } as Express.Multer.File;
}

describe('fotos de empaque', () => {
  it('guarda varias fotos al final y en orden', async () => {
    const { service, uploaded, invalidateTag } = createHarness();
    await service.addImages([file()]);
    const list = await service.addImages([file(), file()]);
    expect(uploaded).toHaveLength(3);
    expect(list.map((photo) => photo.sortOrder)).toEqual([0, 1, 2]);
    expect(list.every((photo) => photo.caption === null)).toBe(true);
    expect(invalidateTag).toHaveBeenCalledWith('packaging');
  });

  it('rechaza pasar el máximo', async () => {
    const { service, rows } = createHarness();
    for (let i = 0; i < MAX_PACKAGING_PHOTOS; i += 1) {
      rows.push({
        id: `photo${i}`,
        imageUrl: `https://res.cloudinary.com/demo/image/upload/v1/p-${i}.jpg`,
        caption: null,
        sortOrder: i,
        createdAt: new Date(i),
        updatedAt: new Date(i),
      });
    }
    await expect(service.addImages([file()])).rejects.toThrow(/máximo|24/i);
  });

  it('limpia el texto y deja el caption vacío en null', async () => {
    const { service } = createHarness();
    const created = await service.addImages([file()]);
    const withCaption = await service.updateCaption(
      created[0].id,
      '  <b>Caja y paño</b>  ',
    );
    expect(withCaption[0].caption).toBe('Caja y paño');
    const cleared = await service.updateCaption(created[0].id, '   ');
    expect(cleared[0].caption).toBeNull();
  });

  it('reordena solo si la lista es exactamente la guardada', async () => {
    const { service } = createHarness();
    const created = await service.addImages([file(), file(), file()]);
    const ids = created.map((photo) => photo.id);
    const reversed = await service.reorder([...ids].reverse());
    expect(reversed.map((photo) => photo.id)).toEqual([...ids].reverse());
    await expect(service.reorder([ids[0], ids[0]])).rejects.toThrow(/repetidas/i);
    await expect(service.reorder([ids[0]])).rejects.toThrow(/recarga/i);
  });

  it('elimina la foto y pide borrar el archivo', async () => {
    const { service, deleted } = createHarness();
    const created = await service.addImages([file(), file()]);
    const removed = created[0];
    const list = await service.remove(removed.id);
    expect(list.map((photo) => photo.id)).toEqual([created[1].id]);
    expect(deleted).toEqual([removed.imageUrl]);
    await expect(service.remove(removed.id)).rejects.toThrow(/no encontrada/i);
  });
});
