import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export type MailProvider = 'smtp' | 'resend' | 'noop';

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class CustomerMailer {
  private readonly logger = new Logger(CustomerMailer.name);

  constructor(private config: ConfigService) {}

  async send(input: OutboundEmail): Promise<{ sent: boolean; provider: MailProvider }> {
    if (this.config.get('USE_MOCKS') === 'true') {
      this.logger.debug(`[mail-mock] to=${input.to} subject=${input.subject}`);
      return { sent: false, provider: 'noop' };
    }

    const from = this.config.get<string>('EMAIL_FROM')?.trim();
    const smtpHost = this.config.get<string>('SMTP_HOST')?.trim();
    const resendKey = this.config.get<string>('RESEND_API_KEY')?.trim();

    if (!from || (!smtpHost && !resendKey)) {
      this.logger.debug(
        `[mail-noop] to=${input.to} subject=${input.subject}`,
      );
      return { sent: false, provider: 'noop' };
    }

    try {
      if (smtpHost) {
        await this.sendSmtp(from, input, smtpHost);
        return { sent: true, provider: 'smtp' };
      }
      await this.sendResend(from, input, resendKey!);
      return { sent: true, provider: 'resend' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo enviar correo a ${input.to}: ${message}`);
      return { sent: false, provider: smtpHost ? 'smtp' : 'resend' };
    }
  }

  private async sendSmtp(from: string, input: OutboundEmail, host: string) {
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const secure =
      this.config.get('SMTP_SECURE') === 'true' || port === 465;
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
    });
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<p>${escapeHtml(input.text)}</p>`,
    });
  }

  private async sendResend(
    from: string,
    input: OutboundEmail,
    apiKey: string,
  ) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html ?? `<p>${escapeHtml(input.text)}</p>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend ${response.status}: ${body.slice(0, 300)}`);
    }
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
