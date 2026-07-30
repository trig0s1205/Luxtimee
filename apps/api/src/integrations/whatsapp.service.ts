import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private config: ConfigService) {}

  buildCheckoutMessage(input: {
    prefix: string;
    customerName: string;
    customerAddress: string;
    customerPhone?: string;
    shippingZoneName?: string;
    shippingCost?: number;
    items: Array<{ label: string; qty: number; price: number }>;
    total: number;
    type: string;
  }) {
    const divider = '━━━━━━━━━━━━━━━━';
    const itemLines = input.items
      .map((item, index) => {
        const lineTotal = item.price * item.qty;
        return [
          `*${index + 1}.* ${item.label}`,
          `   _Cantidad:_ x${item.qty}  ·  _Precio unit.:_ $${item.price.toLocaleString('es-CO')}`,
          lineTotal !== item.price ? `   _Subtotal:_ $${lineTotal.toLocaleString('es-CO')}` : null,
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    const contactBlock = [
      `👤 *Cliente:* ${input.customerName}`,
      input.customerPhone ? `📱 *Teléfono:* ${input.customerPhone}` : null,
      `📍 *Dirección:* ${input.customerAddress}`,
      input.shippingZoneName
        ? `🚚 *Zona de envío:* ${input.shippingZoneName}${input.shippingCost ? ` — $${input.shippingCost.toLocaleString('es-CO')}` : ''}`
        : null,
      `🏷️ *Tipo de pedido:* ${input.type}`,
    ]
      .filter(Boolean)
      .join('\n');

    return [
      `*✨ LUXTIME — Intención de compra*`,
      '',
      input.prefix,
      '',
      contactBlock,
      '',
      `*⌚ Relojes solicitados*`,
      divider,
      itemLines,
      divider,
      '',
      `💰 *Total estimado:* $${input.total.toLocaleString('es-CO')} COP`,
    ].join('\n');
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
      this.logger.debug(`[whatsapp-mock] ${message.slice(0, 200)}`);
      return { ok: true, mock: true };
    }
    return { ok: false, reason: 'WHATSAPP_ACCESS_TOKEN no configurado' };
  }
}
