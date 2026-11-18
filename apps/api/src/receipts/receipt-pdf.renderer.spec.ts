import { ReceiptPdfRenderer } from './receipt-pdf.renderer';

describe('ReceiptPdfRenderer', () => {
  const renderer = new ReceiptPdfRenderer();

  const baseInput = {
    number: 'LXT-000123',
    channel: 'WEB' as const,
    saleDate: new Date('2026-11-08T15:00:00.000Z'),
    issuedAt: new Date('2026-11-08T15:00:00.000Z'),
    orderReadableId: 'LX-20261108-0001',
    customerName: 'Cliente de mostrador',
    customerDocument: null,
    customerPhone: null,
    customerEmail: null,
    sellerName: 'Tienda web',
    subtotal: 200_000,
    shippingCost: 0,
    total: 200_000,
    warrantyTerms: 'Términos de garantía de prueba.',
    footerNote: '',
    businessSnapshot: {
      businessName: 'LUXTIMEE',
      ownerName: '',
      ownerDocument: '',
      phone: '',
      whatsapp: '',
      email: '',
      city: 'Piedecuesta',
      address: '',
      logoUrl: '',
    },
    payments: [
      {
        method: 'NO_ESPECIFICADO',
        label: 'No especificado',
        amount: 200_000,
      },
    ],
    items: [
      {
        productName: 'Rolex Datejust',
        brandName: 'Rolex',
        model: 'Datejust',
        reference: 'DJ-1',
        sku: 'RM-001',
        limitedEditionNumber: '7/50',
        quantity: 1,
        unitPrice: 200_000,
        lineTotal: 200_000,
        warrantyMonths: 12,
        warrantyStartsAt: new Date('2026-11-08T15:00:00.000Z'),
        warrantyEndsAt: new Date('2027-11-08T04:59:59.999Z'),
        warrantyExtraTerms: null,
      },
    ],
    compress: false,
  };

  function extractTjText(buffer: Buffer) {
    const raw = buffer.toString('latin1');
    return [...raw.matchAll(/\[([^\]]*)\]\s*TJ/g)]
      .map((match) =>
        match[1]
          .replace(/<([0-9a-fA-F]+)>/g, (_, hex: string) => {
            const bytes = hex.match(/.{1,2}/g) ?? [];
            return bytes
              .map((b) => String.fromCharCode(parseInt(b, 16)))
              .join('');
          })
          // Solo quita enteros de kerning (aislados por espacios), no dígitos del SKU
          .replace(/\s+-?\d+(?=\s|$)/g, '')
          .replace(/\s+/g, ''),
      )
      .join(' ');
  }

  it('genera un PDF con título, SKU y edición limitada, sin factura ni serial', async () => {
    const buffer = await renderer.render(baseInput);
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
    // pdfkit (compress:false) escribe TJ con kerning numérico entre glifos
    const tjText = extractTjText(buffer);
    expect(tjText).toContain('COMPROBANTEDEVENTAYGARANT');
    expect(tjText.toLowerCase()).toContain('noesfacturaelectr');
    expect(tjText).not.toMatch(/CUFE|resoluci.nDIAN/i);
    expect(tjText).toContain('RM-001');
    expect(tjText).toContain('Edici');
    expect(tjText).toContain('7/50');
    expect(tjText.toLowerCase()).not.toContain('serial');
  });

  it('incluye footerNote en el PDF', async () => {
    const buffer = await renderer.render({
      ...baseInput,
      footerNote: 'Nota de pie de prueba',
    });
    const tjText = extractTjText(buffer);
    expect(tjText.replace(/\s+/g, '')).toContain(
      'Notadepiedeprueba'.replace(/\s+/g, ''),
    );
  });
});




