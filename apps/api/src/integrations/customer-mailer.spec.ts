import { ConfigService } from '@nestjs/config';
import { CustomerMailer } from './customer-mailer.service';
import { CustomerNotifier } from './customer-notifier.service';

function config(values: Record<string, string | undefined>) {
  return {
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as ConfigService;
}

describe('customer mailer', () => {
  it('no envía nada si no hay proveedor', async () => {
    const mailer = new CustomerMailer(
      config({ USE_MOCKS: 'false', EMAIL_FROM: 'LUXTIMEE <a@b.co>' }),
    );
    await expect(
      mailer.send({ to: 'c@d.co', subject: 'Hola', text: 'texto' }),
    ).resolves.toEqual({ sent: false, provider: 'noop' });
  });

  it('no envía nada con USE_MOCKS aunque haya SMTP', async () => {
    const mailer = new CustomerMailer(
      config({
        USE_MOCKS: 'true',
        EMAIL_FROM: 'LUXTIMEE <a@b.co>',
        SMTP_HOST: 'smtp.example.com',
      }),
    );
    await expect(
      mailer.send({ to: 'c@d.co', subject: 'Hola', text: 'texto' }),
    ).resolves.toEqual({ sent: false, provider: 'noop' });
  });
});

describe('customer notifier', () => {
  it('usa el correo del mayorista y arma el enlace de WhatsApp', async () => {
    const sent: Array<{ to: string; subject: string }> = [];
    const mailer = {
      send: async (input: { to: string; subject: string }) => {
        sent.push(input);
        return { sent: true, provider: 'resend' as const };
      },
    };
    const prisma = {
      wholesaleAccess: {
        findUnique: async () => ({
          email: 'mayor@test.co',
          phone: '3001112233',
        }),
      },
    };
    const notifier = new CustomerNotifier(mailer as never, prisma as never);
    const result = await notifier.notifyOrder({
      event: 'created',
      readableId: 'LX-1',
      customerName: 'ANA',
      customerEmail: '',
      customerPhone: null,
      wholesaleAccessId: 'acc',
    });
    expect(sent[0]).toMatchObject({
      to: 'mayor@test.co',
      subject: 'LUXTIMEE — pre-pedido LX-1 recibido',
    });
    expect(result.emailed).toBe(true);
    expect(result.whatsappUrl).toContain('https://wa.me/573001112233?text=');
  });

  it('no llama al correo si no hay email', async () => {
    const mailer = { send: jest.fn() };
    const prisma = {
      wholesaleAccess: { findUnique: async () => null },
    };
    const notifier = new CustomerNotifier(mailer as never, prisma as never);
    const result = await notifier.notifyOrder({
      event: 'shipped',
      readableId: 'LX-2',
      customerName: 'ANA',
      customerEmail: '',
      customerPhone: '3001112233',
    });
    expect(mailer.send).not.toHaveBeenCalled();
    expect(result.emailed).toBe(false);
    expect(result.whatsappUrl).toContain('wa.me/573001112233');
  });
});
