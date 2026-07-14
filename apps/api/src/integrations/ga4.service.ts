import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthDashboardDto } from '@luxtime/shared';

@Injectable()
export class Ga4Service {
  constructor(private config: ConfigService) {}

  async getEngagementMetrics(): Promise<HealthDashboardDto> {
    if (this.config.get('USE_MOCKS') === 'true' || !this.config.get('GA4_PROPERTY_ID')) {
      return {
        periodLabel: 'Últimos 30 días vs periodo anterior',
        metrics: [
          { key: 'sessions', label: 'Sesiones', current: 1240, previous: 980, changePercent: 26.5 },
          { key: 'product_views', label: 'Vistas de producto', current: 3420, previous: 2900, changePercent: 17.9 },
          { key: 'avg_session', label: 'Duración media (s)', current: 142, previous: 128, changePercent: 10.9 },
          { key: 'cart_abandon', label: 'Abandono carrito (%)', current: 62, previous: 68, changePercent: -8.8 },
        ],
      };
    }
    return {
      periodLabel: 'GA4 no configurado',
      metrics: [],
    };
  }
}
