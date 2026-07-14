import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsappService {
  constructor(private config: ConfigService) {}

  buildCheckoutMessage(input: {
    prefix: string;
    customerName: string;
    customerAddress: string;
    readableId: string;
    items: Array<{ name: string; qty: number; price: number }>;
    total: number;
    type: string;
  }) {
    const lines = input.items.map((i) => `• ${i.name} x${i.qty}`).join('\n');
    return `${input.prefix}\n\nPedido: ${input.readableId}\nCliente: ${input.customerName}\nDirección: ${input.customerAddress}\nTipo: ${input.type}\n\n${lines}\n\nTotal estimado: $${input.total.toLocaleString('es-CO')} COP`;
  }

  buildRedirectUrl(baseUrl: string, message: string) {
    const phone = baseUrl.replace(/[^\d]/g, '').replace(/^57/, '');
    const text = encodeURIComponent(message);
    if (this.config.get('USE_MOCKS') === 'true' || !baseUrl.includes('wa.me')) {
      return `https://wa.me/${phone || '573000000000'}?text=${text}`;
    }
    return `${baseUrl}?text=${text}`;
  }

  async notifyStaff(message: string) {
    if (this.config.get('USE_MOCKS') === 'true') {
      console.log('[whatsapp-mock]', message);
      return { ok: true, mock: true };
    }
    // Integración real con Meta Cloud API en producción
    return { ok: false, reason: 'WHATSAPP_ACCESS_TOKEN no configurado' };
  }
}
