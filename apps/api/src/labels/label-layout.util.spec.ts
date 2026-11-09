import {
  expandLabelItems,
  sheetSlots,
  SHEET,
  mmToPt,
} from './label-layout.util';

describe('label-layout.util', () => {
  it('30 etiquetas = 1 página; 31 = 2 páginas', () => {
    expect(sheetSlots(30, 1).every((s) => s.page === 0)).toBe(true);
    const slots31 = sheetSlots(31, 1);
    expect(slots31[30].page).toBe(1);
    expect(new Set(slots31.map((s) => s.page)).size).toBe(2);
  });

  it('startPosition 29 con 3 etiquetas cruza de página', () => {
    const slots = sheetSlots(3, 29);
    expect(slots[0]).toMatchObject({ page: 0 });
    expect(slots[1]).toMatchObject({ page: 0 });
    expect(slots[2]).toMatchObject({ page: 1 });
  });

  it('posición 1 y 30 en coordenadas Avery', () => {
    const first = sheetSlots(1, 1)[0];
    const last = sheetSlots(1, 30)[0];
    expect(first.x).toBeCloseTo(SHEET.marginLeft, 5);
    expect(first.y).toBeCloseTo(SHEET.marginTop, 5);
    expect(last.x).toBeCloseTo(SHEET.marginLeft + 2 * SHEET.stepX, 5);
    expect(last.y).toBeCloseTo(SHEET.marginTop + 9 * SHEET.stepY, 5);
  });

  it('offsets en mm se suman', () => {
    const base = sheetSlots(1, 1, 0, 0)[0];
    const moved = sheetSlots(1, 1, 1, -0.5)[0];
    expect(moved.x - base.x).toBeCloseTo(mmToPt(1), 5);
    expect(moved.y - base.y).toBeCloseTo(mmToPt(-0.5), 5);
  });

  it('cantidad 0 se ignora; 1001 falla', () => {
    expect(
      expandLabelItems([
        { watchId: 'a', quantity: 0 },
        { watchId: 'b', quantity: 2 },
      ]),
    ).toHaveLength(2);
    expect(() =>
      expandLabelItems([{ watchId: 'a', quantity: 1001 }]),
    ).toThrow(/Máximo 1000/);
    expect(() => expandLabelItems([{ watchId: 'a', quantity: 0 }])).toThrow(
      /al menos una/,
    );
  });
});
