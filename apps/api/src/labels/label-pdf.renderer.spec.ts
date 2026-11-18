import { LabelPdfRenderer } from './label-pdf.renderer';
import * as bwipjs from 'bwip-js';

describe('LabelPdfRenderer', () => {
  const renderer = new LabelPdfRenderer();

  it('genera PDF con SKU y marca; precio opcional; térmica multipágina', async () => {
    const watches = Array.from({ length: 10 }, () => ({
      id: 'w1',
      sku: 'RM-001',
      brandName: 'Casio',
      model: 'A168',
      retailPrice: 120_000,
    }));

    const noPrice = await renderer.render(watches, {
      layout: 'SHEET_LETTER_3X10',
      includePrice: false,
      compress: false,
    });
    expect(noPrice.subarray(0, 4).toString('utf8')).toBe('%PDF');
    const decodedNoPrice = decodeTj(noPrice);
    expect(decodedNoPrice).toContain('RM-001');
    expect(decodedNoPrice.toUpperCase()).toContain('CASIO');
    expect(decodedNoPrice).not.toContain('120');

    const withPrice = await renderer.render(watches.slice(0, 1), {
      layout: 'SHEET_LETTER_3X10',
      includePrice: true,
      compress: false,
    });
    expect(decodeTj(withPrice)).toContain('120');

    const thermal = await renderer.render(watches.slice(0, 3), {
      layout: 'THERMAL_50X25',
      compress: false,
    });
    expect(thermal.toString('latin1')).toMatch(/\/Count\s*3/);
  });

  it('PNG de bwip-js empieza por firma PNG', async () => {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: 'RM-001',
      scale: 4,
      height: 10,
      includetext: false,
      paddingwidth: 10,
      paddingheight: 0,
      backgroundcolor: 'FFFFFF',
    });
    const buf = Buffer.from(png);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });
});

function decodeTj(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  return [...raw.matchAll(/\[([^\]]*)\]\s*TJ/g)]
    .map((m) =>
      m[1]
        .replace(/<([0-9a-fA-F]+)>/g, (_, hex: string) => {
          const bytes = hex.match(/.{1,2}/g) ?? [];
          return bytes
            .map((b) => String.fromCharCode(parseInt(b, 16)))
            .join('');
        })
        .replace(/\s+-?\d+(?=\s|$)/g, '')
        .replace(/\s+/g, ''),
    )
    .join(' ');
}
