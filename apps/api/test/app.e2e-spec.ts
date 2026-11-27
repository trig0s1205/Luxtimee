import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { assertLocalDatabaseUrl } from '../src/watches/local-database';

describe('API local (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    assertLocalDatabaseUrl(process.env.DATABASE_URL);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'ok') throw new Error(JSON.stringify(res.body));
      });
  });

  it('ADMIN recibe 403 en ganancia y en todas las ventas', async () => {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) throw new Error('SEED_ADMIN_PASSWORD es obligatoria');
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .send({ email: 'lidia@luxtime.co', password })
      .expect(201);
    await agent.get('/api/v1/dashboards/profit').expect(403);
    await agent.get('/api/v1/dashboards/sales').expect(403);
  });

  it('SUPER_ADMIN lee ganancia y todas las ventas', async () => {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) throw new Error('SEED_ADMIN_PASSWORD es obligatoria');
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .send({ email: 'alvaro@luxtime.co', password })
      .expect(201);
    await agent.get('/api/v1/dashboards/profit?period=month&channel=ALL').expect(200);
    await agent.get('/api/v1/dashboards/sales?channel=ALL').expect(200);
  });
});
