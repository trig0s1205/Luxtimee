import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { ReportsService } from '../integrations/reports.service';
import { Ga4Service } from '../integrations/ga4.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialGuard } from '../common/guards/financial.guard';

describe('dashboards financieros', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardsController],
      providers: [
        RolesGuard,
        FinancialGuard,
        {
          provide: DashboardsService,
          useValue: {
            getProfitDashboard: jest.fn().mockResolvedValue({ ok: true }),
            listFinancialSales: jest.fn().mockResolvedValue({ items: [], total: 0 }),
          },
        },
        { provide: ReportsService, useValue: {} },
        { provide: Ga4Service, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.use((req: { headers: Record<string, string | undefined>; user?: { role: string; name: string; email: string } }, _res: unknown, next: () => void) => {
      req.user = {
        role: req.headers['x-role'] ?? 'ADMIN',
        name: 'Test',
        email: 't@luxtimee.test',
      };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ADMIN recibe 403 en ganancia y en todas las ventas', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboards/profit')
      .set('x-role', 'ADMIN')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/dashboards/sales')
      .set('x-role', 'ADMIN')
      .expect(403);
  });

  it('SUPER_ADMIN puede leer ambos endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboards/profit?channel=LOCAL')
      .set('x-role', 'SUPER_ADMIN')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/dashboards/sales?channel=WEB')
      .set('x-role', 'SUPER_ADMIN')
      .expect(200);
  });
});
