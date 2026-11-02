import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';

describe('mensaje de checkout', () => {
  it('pide el abono de 10.000 por reloj', () => {
    const service = new WhatsappService({ get: () => undefined } as unknown as ConfigService);
    const message = service.buildCheckoutMessage({
      prefix: 'Hola',
      customerName: 'ANA',
      customerAddress: 'CALLE 1',
      items: [{ label: 'Reloj', qty: 10, price: 50_000 }],
      total: 500_000,
      type: 'DETAL',
    });
    expect(message).toContain('Abono para confirmar el pedido');
    expect(message).toContain('10 relojes');
    expect(message).toMatch(/100[.,\s]000/);
    expect(message).toContain('por reloj');
  });
});