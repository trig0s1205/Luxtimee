import { Logger, UnauthorizedException, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthService,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_LOCKOUT_THRESHOLD,
} from './auth.service';
import { AuthController } from './auth.controller';
import { hashPassword } from './password.util';
import { resolveStaffLoginSlug } from './staff-login-slug';
import { JwtStrategy } from './strategies/jwt.strategy';

jest.setTimeout(30_000);

const ACCESS_SECRET = 'access-secret-test';
const REFRESH_SECRET = 'refresh-secret-test';

type UserRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  passwordHash: string | null;
  role: Role;
  tokenVersion: number;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  failedLoginAt: Date | null;
  googleId: string | null;
};

type SessionRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
};

function createPrisma() {
  const users: UserRow[] = [];
  const sessions: SessionRow[] = [];

  function cloneUser(row: UserRow): UserRow {
    return {
      ...row,
      lockedUntil: row.lockedUntil ? new Date(row.lockedUntil) : null,
      failedLoginAt: row.failedLoginAt ? new Date(row.failedLoginAt) : null,
    };
  }

  function pick(row: UserRow, select?: Record<string, boolean>) {
    const full = cloneUser(row);
    if (!select) return full;
    const out: Record<string, unknown> = {};
    for (const [key, enabled] of Object.entries(select)) {
      if (enabled) out[key] = full[key as keyof UserRow];
    }
    return out;
  }

  function apply(row: UserRow, data: Record<string, unknown>) {
    for (const [key, value] of Object.entries(data)) {
      if (
        value
        && typeof value === 'object'
        && value !== null
        && 'increment' in value
      ) {
        const current = row[key as keyof UserRow];
        const amount = (value as { increment: number }).increment;
        (row as unknown as Record<string, unknown>)[key] = Number(current) + amount;
      } else {
        (row as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }

  function findUser(where: { id?: string; email?: string }) {
    return users.find((row) => {
      if (where.id && row.id !== where.id) return false;
      if (where.email && row.email !== where.email) return false;
      return Boolean(where.id || where.email);
    });
  }

  const prisma = {
    user: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { id?: string; email?: string };
        select?: Record<string, boolean>;
      }) => {
        const row = findUser(where);
        return row ? pick(row, select) : null;
      },
      update: async ({
        where,
        data,
        select,
      }: {
        where: { id?: string; email?: string };
        data: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        const row = findUser(where);
        if (!row) throw new Error('usuario inexistente');
        apply(row, data);
        return pick(row, select);
      },
    },
    refreshSession: {
      create: async ({
        data,
      }: {
        data: { id: string; userId: string; expiresAt: Date };
      }) => {
        const row: SessionRow = { ...data, createdAt: new Date() };
        sessions.push(row);
        return row;
      },
      deleteMany: async ({
        where,
      }: {
        where: {
          id?: string;
          userId?: string;
          expiresAt?: { gt?: Date };
        };
      }) => {
        const before = sessions.length;
        for (let i = sessions.length - 1; i >= 0; i -= 1) {
          const row = sessions[i];
          if (where.id && row.id !== where.id) continue;
          if (where.userId && row.userId !== where.userId) continue;
          if (where.expiresAt?.gt && !(row.expiresAt > where.expiresAt.gt)) continue;
          sessions.splice(i, 1);
        }
        return { count: before - sessions.length };
      },
    },
    users,
    sessions,
  };

  return prisma;
}

function cookieValue(setCookie: string | string[] | undefined, name: string) {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const raw = list.find((item) => item.startsWith(`${name}=`));
  if (!raw) return '';
  return decodeURIComponent(raw.split(';')[0].slice(name.length + 1));
}

describe('resolveStaffLoginSlug', () => {
  it('cierra el slug en producción si no está configurado', () => {
    expect(resolveStaffLoginSlug(undefined, 'production')).toBeNull();
    expect(resolveStaffLoginSlug('  ', 'production')).toBeNull();
    expect(resolveStaffLoginSlug('portal-real', 'production')).toBe('portal-real');
    expect(resolveStaffLoginSlug(undefined, 'development')).toBe('dev-portal-lx9k2');
  });
});

describe('auth security', () => {
  let app: NestExpressApplication;
  let prisma: ReturnType<typeof createPrisma>;
  const password = 'correct-password';

  beforeAll(async () => {
    prisma = createPrisma();
    prisma.users.push({
      id: 'user-1',
      email: 'admin@luxtimee.test',
      name: 'Admin',
      phone: null,
      passwordHash: hashPassword(password),
      role: Role.ADMIN,
      tokenVersion: 0,
      failedLoginAttempts: 0,
      lockedUntil: null,
      failedLoginAt: null,
      googleId: null,
    });
    prisma.users.push({
      id: 'user-lock',
      email: 'lock@luxtimee.test',
      name: 'Lock',
      phone: null,
      passwordHash: hashPassword(password),
      role: Role.ADMIN,
      tokenVersion: 0,
      failedLoginAttempts: 0,
      lockedUntil: null,
      failedLoginAt: null,
      googleId: null,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({
            JWT_SECRET: `${ACCESS_SECRET}\n`,
            JWT_REFRESH_SECRET: REFRESH_SECRET,
            JWT_ACCESS_EXPIRES: '15m\n',
            JWT_REFRESH_EXPIRES: '7d',
            NODE_ENV: 'test',
          })],
        }),
        JwtModule.register({}),
        PassportModule.register({ defaultStrategy: 'jwt' }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma as unknown as PrismaService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function server() {
    return app.getHttpServer();
  }

  it('no devuelve tokens en el body y rechaza el refresh como Bearer y el access en /refresh', async () => {
    const agent = request.agent(server());
    const login = await agent.post('/api/v1/auth/login').send({
      email: 'admin@luxtimee.test',
      password,
    });

    expect(login.status).toBe(201);
    expect(login.body.user.email).toBe('admin@luxtimee.test');
    expect(login.body.accessToken).toBeUndefined();
    expect(login.body.refreshToken).toBeUndefined();
    expect(JSON.stringify(login.body)).not.toContain('eyJ');

    const access = cookieValue(login.headers['set-cookie'], 'LUXTIMEE_access');
    const refresh = cookieValue(login.headers['set-cookie'], 'LUXTIMEE_refresh');
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
    expect(String(login.headers['set-cookie'])).toContain('HttpOnly');

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe('user-1');

    const withAnalytics = await request(server())
      .get('/api/v1/auth/me')
      .set(
        'Cookie',
        `_ga=GA1.1.111.222; LUXTIMEE_access=${access}; LUXTIMEE_refresh=${refresh}`,
      );
    expect(withAnalytics.status).toBe(200);
    expect(withAnalytics.body.message).not.toBe('Sesión inválida o expirada');

    const refreshAsBearer = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refresh}`);
    expect(refreshAsBearer.status).toBe(401);

    const jwt = app.get(JwtService);
    const forgedRefresh = await jwt.signAsync({
      sub: 'user-1',
      email: 'admin@luxtimee.test',
      role: Role.ADMIN,
      typ: 'refresh',
      tv: 0,
      jti: 'forged',
    }, { secret: ACCESS_SECRET, expiresIn: '5m' });
    const forged = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forgedRefresh}`);
    expect(forged.status).toBe(401);

    const accessAsRefresh = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `LUXTIMEE_refresh=${access}`)
      .send({});
    expect(accessAsRefresh.status).toBe(401);

    const rotated = await agent.post('/api/v1/auth/refresh').send({});
    expect(rotated.status).toBe(201);
    expect(rotated.body).toEqual({ ok: true });
    expect(rotated.body.accessToken).toBeUndefined();
    expect(rotated.body.refreshToken).toBeUndefined();

    const reused = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `LUXTIMEE_refresh=${refresh}`)
      .send({});
    expect(reused.status).toBe(401);

    const strategy = app.get(JwtStrategy);
    await expect(strategy.validate({
      sub: 'user-1',
      email: 'admin@luxtimee.test',
      role: Role.ADMIN,
      typ: 'refresh',
      tv: 0,
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revoca access y refresh cuando sube tokenVersion en logout', async () => {
    const agent = request.agent(server());
    const login = await agent.post('/api/v1/auth/login').send({
      email: 'admin@luxtimee.test',
      password,
    });
    expect(login.status).toBe(201);
    const access = cookieValue(login.headers['set-cookie'], 'LUXTIMEE_access');
    const refresh = cookieValue(login.headers['set-cookie'], 'LUXTIMEE_refresh');

    const logout = await agent.post('/api/v1/auth/logout').send({});
    expect(logout.status).toBe(201);

    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Cookie', `LUXTIMEE_access=${access}`);
    expect(me.status).toBe(401);

    const refreshed = await request(server())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `LUXTIMEE_refresh=${refresh}`)
      .send({});
    expect(refreshed.status).toBe(401);

    const row = prisma.users.find((user) => user.id === 'user-1');
    expect(row?.tokenVersion).toBeGreaterThan(0);
  });

  it('bloquea el email tras N fallos y usa un mensaje genérico', async () => {
    for (let i = 0; i < LOGIN_LOCKOUT_THRESHOLD; i += 1) {
      const failed = await request(server()).post('/api/v1/auth/login').send({
        email: 'lock@luxtimee.test',
        password: 'wrong-password',
      });
      expect(failed.status).toBe(401);
      expect(failed.body.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    }

    const locked = await request(server()).post('/api/v1/auth/login').send({
      email: 'lock@luxtimee.test',
      password,
    });
    expect(locked.status).toBe(401);
    expect(locked.body.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(JSON.stringify(locked.body).toLowerCase()).not.toContain('bloque');
  });

  it('registra req.ip con trust proxy y no el primer X-Forwarded-For', async () => {
    const warnings: string[] = [];
    const spy = jest.spyOn(Logger.prototype, 'warn').mockImplementation((message) => {
      warnings.push(String(message));
    });

    const res = await request(server())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.9, 198.51.100.20')
      .send({ email: 'admin@luxtimee.test', password: 'wrong-password' });

    expect(res.status).toBe(401);
    const line = warnings.find((item) => item.includes('Login fallido'));
    expect(line).toContain('ip=198.51.100.20');
    expect(line).not.toContain('203.0.113.9');
    spy.mockRestore();
  });
});
