import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerMailer } from './customer-mailer.service';
import { buildCustomerWhatsappUrl } from './customer-whatsapp';

export type CustomerOrderEvent =
  | 'created'
  | 'deposit_confirmed'
  | 'suspended'
  | 'canceled'
  | 'shipped';

const SUBJECTS: Record<CustomerOrderEvent, (id: string) => string> = {
  created: (id) => `LUXTIMEE — pre-pedido ${id} recibido`,
  deposit_confirmed: (id) => `LUXTIMEE — abono confirmado ${id}`,
  suspended: (id) => `LUXTIMEE — pre-pedido ${id} suspendido`,
  canceled: (id) => `LUXTIMEE — pedido ${id} cancelado`,
  shipped: (id) => `LUXTIMEE — pedido ${id} enviado`,
};

function messageFor(event: CustomerOrderEvent, readableId: string, name: string) {
  const who = name?.trim() ? ` ${name.trim()}` : '';
  switch (event) {
    case 'created':
      return `Hola${who}. Recibimos tu pre-pedido ${readableId}. Tienes 24 horas para confirmar el abono.`;
    case 'deposit_confirmed':
      return `Hola${who}. Confirmamos el abono de tu pedido ${readableId}.`;
    case 'suspended':
      return `Hola${who}. Tu pre-pedido ${readableId} quedó suspendido porque no se confirmó el abono. Responde para reactivarlo.`;
    case 'canceled':
      return `Hola${who}. Tu pedido ${readableId} fue cancelado.`;
    case 'shipped':
      return `Hola${who}. Tu pedido ${readableId} fue enviado.`;
  }
}

@Injectable()
export class CustomerNotifier {
  private readonly logger = new Logger(CustomerNotifier.name);

  constructor(
    private mailer: CustomerMailer,
    private prisma: PrismaService,
  ) {}

  async notifyOrder(input: {
    event: CustomerOrderEvent;
    readableId: string;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
    wholesaleAccessId?: string | null;
  }): Promise<{ emailed: boolean; whatsappUrl: string | null }> {
    let email = input.customerEmail?.trim() ?? '';
    let phone = input.customerPhone?.trim() || null;
    if ((!email || !phone) && input.wholesaleAccessId) {
      const access = await this.prisma.wholesaleAccess.findUnique({
        where: { id: input.wholesaleAccessId },
        select: { email: true, phone: true },
      });
      if (!email) email = access?.email?.trim() ?? '';
      if (!phone) phone = access?.phone?.trim() || null;
    }

    const text = messageFor(input.event, input.readableId, input.customerName);
    const whatsappUrl = buildCustomerWhatsappUrl(phone, text);
    if (!email.includes('@')) {
      return { emailed: false, whatsappUrl };
    }

    try {
      const result = await this.mailer.send({
        to: email,
        subject: SUBJECTS[input.event](input.readableId),
        text,
        html: `<p>${escapeHtml(text)}</p>`,
      });
      return { emailed: result.sent, whatsappUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Aviso de ${input.readableId} no enviado: ${message}`,
      );
      return { emailed: false, whatsappUrl };
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
