import { createPrivateKey, createSign } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Ga4EngagementDto, Ga4StatusDto, HealthMetricDto } from '@luxtime/shared';

type ReportValue = { current: number; previous: number };

@Injectable()
export class Ga4Service {
  private readonly logger = new Logger(Ga4Service.name);

  constructor(private config: ConfigService) {}

  async getStatus(): Promise<Ga4StatusDto> {
    const propertyId = this.config.get<string>('GA4_PROPERTY_ID')?.trim() || null;
    const clientEmail = this.config.get<string>('GA4_CLIENT_EMAIL')?.trim() || null;
    const privateKey = this.getPrivateKey();

    if (!propertyId || !clientEmail || !privateKey) {
      return {
        configured: false,
        connected: false,
        propertyId,
        clientEmail,
        error: 'Faltan GA4_PROPERTY_ID, GA4_CLIENT_EMAIL o GA4_PRIVATE_KEY en la API.',
      };
    }

    try {
      await this.fetchReport(propertyId, [{ name: 'sessions' }]);
      return { configured: true, connected: true, propertyId, clientEmail, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo conectar con GA4';
      this.logger.warn(`GA4 status check failed: ${message}`);
      return { configured: true, connected: false, propertyId, clientEmail, error: message };
    }
  }

  async getEngagementMetrics(periodLabel = 'Últimos 30 días'): Promise<Ga4EngagementDto> {
    const label = `${periodLabel} vs periodo anterior`;
    const propertyId = this.config.get<string>('GA4_PROPERTY_ID')?.trim();
    const clientEmail = this.config.get<string>('GA4_CLIENT_EMAIL')?.trim();
    const privateKey = this.getPrivateKey();

    if (
      this.config.get('USE_MOCKS') === 'true'
      || !propertyId
      || !clientEmail
      || !privateKey
    ) {
      return { periodLabel: label, source: 'mock', metrics: this.mockMetrics() };
    }

    try {
      const baseMetrics = await this.fetchReport(propertyId, [
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
      ]);
      const addToCart = await this.fetchEventCount(propertyId, 'add_to_cart');
      const checkout = await this.fetchEventCount(propertyId, 'checkout_complete');

      const cartCurrent = addToCart.current > 0
        ? Math.round((1 - checkout.current / addToCart.current) * 1000) / 10
        : 0;
      const cartPrevious = addToCart.previous > 0
        ? Math.round((1 - checkout.previous / addToCart.previous) * 1000) / 10
        : 0;

      return {
        periodLabel: label,
        source: 'live',
        metrics: [
          this.toMetric('sessions', 'Sesiones', baseMetrics.sessions),
          this.toMetric('product_views', 'Vistas de página', baseMetrics.screenPageViews),
          this.toMetric('avg_session', 'Duración media (s)', baseMetrics.averageSessionDuration, true),
          {
            key: 'cart_abandon',
            label: 'Abandono carrito (%)',
            current: cartCurrent,
            previous: cartPrevious,
            changePercent: this.changePercent(cartCurrent, cartPrevious),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando GA4';
      this.logger.error(message);
      return {
        periodLabel: label,
        source: 'mock',
        error: message,
        metrics: this.mockMetrics(),
      };
    }
  }

  private mockMetrics(): HealthMetricDto[] {
    return [
      { key: 'sessions', label: 'Sesiones', current: 1240, previous: 980, changePercent: 26.5 },
      { key: 'product_views', label: 'Vistas de página', current: 3420, previous: 2900, changePercent: 17.9 },
      { key: 'avg_session', label: 'Duración media (s)', current: 142, previous: 128, changePercent: 10.9 },
      { key: 'cart_abandon', label: 'Abandono carrito (%)', current: 62, previous: 68, changePercent: -8.8 },
    ];
  }

  private toMetric(
    key: string,
    label: string,
    values: ReportValue,
    round = false,
  ): HealthMetricDto {
    const current = round ? Math.round(values.current) : values.current;
    const previous = round ? Math.round(values.previous) : values.previous;
    return {
      key,
      label,
      current,
      previous,
      changePercent: this.changePercent(current, previous),
    };
  }

  private changePercent(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private getPrivateKey(): string {
    let raw = this.config.get<string>('GA4_PRIVATE_KEY', '').trim();
    if (!raw) return '';

    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as { private_key?: string };
        if (parsed.private_key) raw = parsed.private_key;
      } catch {
        // no es JSON completo
      }
    }

    raw = raw.replace(/^["']|["']$/g, '');
    raw = raw.replace(/\\n/g, '\n');

    if (!raw.includes('\n') && raw.includes('-----BEGIN')) {
      raw = raw
        .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
        .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
        .replace('-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----\n')
        .replace('-----END RSA PRIVATE KEY-----', '\n-----END RSA PRIVATE KEY-----');
    }

    try {
      createPrivateKey(raw);
    } catch {
      throw new Error(
        'GA4_PRIVATE_KEY inválida en Secret Manager. Pega solo el campo private_key del JSON (con saltos de línea).',
      );
    }

    return raw;
  }

  private async getAccessToken(): Promise<string> {
    const clientEmail = this.config.get<string>('GA4_CLIENT_EMAIL')?.trim();
    const privateKey = this.getPrivateKey();
    if (!clientEmail || !privateKey) {
      throw new Error('Credenciales GA4 incompletas');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })).toString('base64url');

    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    signer.end();
    const signature = signer.sign(privateKey, 'base64url');
    const jwt = `${header}.${claim}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const data = await response.json() as { access_token?: string; error_description?: string };
    if (!response.ok || !data.access_token) {
      throw new Error(data.error_description ?? 'No se pudo obtener token de GA4');
    }
    return data.access_token;
  }

  private async fetchReport(
    propertyId: string,
    metrics: Array<{ name: string }>,
  ): Promise<Record<string, ReportValue>> {
    const token = await this.getAccessToken();
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            { startDate: '30daysAgo', endDate: 'today', name: 'current' },
            { startDate: '60daysAgo', endDate: '31daysAgo', name: 'previous' },
          ],
          metrics,
        }),
      },
    );

    const data = await response.json() as {
      rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message ?? `GA4 respondió ${response.status}`);
    }

    const values = data.rows?.[0]?.metricValues ?? [];
    const result: Record<string, ReportValue> = {};

    metrics.forEach((metric, index) => {
      result[metric.name] = {
        current: Number(values[index * 2]?.value ?? 0),
        previous: Number(values[index * 2 + 1]?.value ?? 0),
      };
    });

    return result;
  }

  private async fetchEventCount(propertyId: string, eventName: string): Promise<ReportValue> {
    const token = await this.getAccessToken();
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            { startDate: '30daysAgo', endDate: 'today', name: 'current' },
            { startDate: '60daysAgo', endDate: '31daysAgo', name: 'previous' },
          ],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              stringFilter: { matchType: 'EXACT', value: eventName },
            },
          },
        }),
      },
    );

    const data = await response.json() as {
      rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message ?? `GA4 event ${eventName} respondió ${response.status}`);
    }

    const values = data.rows?.[0]?.metricValues ?? [];
    return {
      current: Number(values[0]?.value ?? 0),
      previous: Number(values[1]?.value ?? 0),
    };
  }
}
