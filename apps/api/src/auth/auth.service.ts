import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import { readJwtSecret, readTokenDuration } from './jwt-config';
import { hashPassword, verifyPassword } from './password.util';

export const LOGIN_LOCKOUT_THRESHOLD = 5;
export const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos';

export type TokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  typ: TokenType;
  tv: number;
  jti?: string;
}

const STAFF_ROLES = new Set<Role>([Role.ADMIN, Role.SUPER_ADMIN]);

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  tokenVersion: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private warnedRefreshFallback = false;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  private assertStaffRole(role: Role) {
    if (!STAFF_ROLES.has(role)) {
      throw new UnauthorizedException(
        'No tienes acceso al panel de administración',
      );
    }
  }

  private accessSecret() {
    return readJwtSecret(this.config.get<string>('JWT_SECRET'));
  }

  private refreshSecret() {
    const dedicated = this.config.get<string>('JWT_REFRESH_SECRET')?.trim();
    if (dedicated) return dedicated;
    if (
      this.config.get('NODE_ENV') === 'production' &&
      !this.warnedRefreshFallback
    ) {
      this.warnedRefreshFallback = true;
      this.logger.warn(
        'JWT_REFRESH_SECRET no está definido; se usa JWT_SECRET. Define un secreto distinto en Cloud Run.',
      );
    }
    return this.accessSecret();
  }

  private accessDuration() {
    return readTokenDuration(this.config.get<string>('JWT_ACCESS_EXPIRES'), '15m');
  }

  private refreshDuration() {
    return readTokenDuration(this.config.get<string>('JWT_REFRESH_EXPIRES'), '90d');
  }

  async validateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
  }) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: profile.googleId }, { email: profile.email }],
      },
    });

    if (!existing) {
      throw new UnauthorizedException(
        'No tienes acceso al panel de administración',
      );
    }

    this.assertStaffRole(existing.role);

    return this.prisma.user.update({
      where: { id: existing.id },
      data: {
        googleId: profile.googleId,
        name: profile.name,
        email: profile.email,
      },
    });
  }

  async loginWithPassword(email: string, password: string, clientIp?: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
    });

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      this.logFailedLogin(normalized, clientIp);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordOk = Boolean(
      user?.passwordHash && verifyPassword(password, user.passwordHash),
    );

    if (!user || !passwordOk) {
      if (user) await this.recordFailedLogin(user);
      this.logFailedLogin(normalized, clientIp);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.failedLoginAttempts || user.lockedUntil || user.failedLoginAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          failedLoginAt: null,
        },
      });
    }

    this.assertStaffRole(user.role);
    return user;
  }

  /**
   * El contador vive en Postgres: Cloud Run puede correr varias instancias y
   * escala a cero, así que un mapa en memoria no se comparte y se pierde.
   * Solo se cuenta sobre usuarios existentes para no llenar la tabla con emails arbitrarios.
   */
  private async recordFailedLogin(user: {
    id: string;
    failedLoginAttempts: number;
    failedLoginAt: Date | null;
  }) {
    const now = new Date();
    const stale =
      !user.failedLoginAt ||
      now.getTime() - user.failedLoginAt.getTime() > LOGIN_LOCKOUT_WINDOW_MS;

    if (stale) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 1,
          failedLoginAt: now,
          lockedUntil: null,
        },
      });
      return;
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: { increment: 1 },
        failedLoginAt: now,
      },
      select: { failedLoginAttempts: true },
    });

    if (updated.failedLoginAttempts >= LOGIN_LOCKOUT_THRESHOLD) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(now.getTime() + LOGIN_LOCKOUT_WINDOW_MS),
          failedLoginAt: now,
        },
      });
    }
  }

  logFailedLogin(email: string, clientIp?: string) {
    const normalized = email.trim().toLowerCase();
    const masked = normalized.includes('@')
      ? `${normalized[0]}***@${normalized.split('@')[1]}`
      : '***';
    this.logger.warn(
      `Login fallido ip=${clientIp ?? 'unknown'} email=${masked}`,
    );
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined
          ? { phone: data.phone.trim() || null }
          : {}),
      },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
  }

  async changeEmail(userId: string, email: string, currentPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (user.passwordHash) {
      if (
        !currentPassword ||
        !verifyPassword(currentPassword, user.passwordHash)
      ) {
        throw new UnauthorizedException('La contraseña actual no es correcta');
      }
    }

    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Ese correo ya está en uso');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { email: normalized },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
  }

  async changePassword(
    userId: string,
    newPassword: string,
    currentPassword?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (user.passwordHash) {
      if (
        !currentPassword ||
        !verifyPassword(currentPassword, user.passwordHash)
      ) {
        throw new UnauthorizedException('La contraseña actual no es correcta');
      }
    }

    if (newPassword.length < 6) {
      throw new BadRequestException(
        'La nueva contraseña debe tener al menos 6 caracteres',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(newPassword),
        tokenVersion: { increment: 1 },
      },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
    await this.prisma.refreshSession.deleteMany({ where: { userId } });
    return updated;
  }

  async revokeSessions(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.prisma.refreshSession.deleteMany({ where: { userId } });
  }

  async mockLogin(email: string, name: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      throw new UnauthorizedException(
        'Solo personal autorizado puede iniciar sesión',
      );
    }

    this.assertStaffRole(existing.role);

    return this.prisma.user.update({
      where: { email },
      data: { name },
    });
  }

  private async loadSessionUser(userId: string): Promise<SessionUser> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        tokenVersion: true,
      },
    });
    if (!current) throw new UnauthorizedException();
    return current;
  }

  private async signPair(user: SessionUser, jti: string) {
    const base = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
    };

    const accessToken = await this.jwtService.signAsync(
      { ...base, typ: 'access' satisfies TokenType },
      {
        secret: this.accessSecret(),
        expiresIn: this.accessDuration().expiresIn,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...base, typ: 'refresh' satisfies TokenType, jti },
      {
        secret: this.refreshSecret(),
        expiresIn: this.refreshDuration().expiresIn,
      },
    );

    return { accessToken, refreshToken };
  }

  private async persistRefreshSession(userId: string, jti: string) {
    const maxAge = this.refreshDuration().maxAgeMs;
    await this.prisma.refreshSession.create({
      data: {
        id: jti,
        userId,
        expiresAt: new Date(Date.now() + maxAge),
      },
    });
  }

  async issueTokens(user: { id: string }) {
    const current = await this.loadSessionUser(user.id);
    const jti = randomUUID();
    await this.persistRefreshSession(current.id, jti);
    return this.signPair(current, jti);
  }

  async issueAccessToken(userId: string) {
    const current = await this.loadSessionUser(userId);
    return this.jwtService.signAsync(
      {
        sub: current.id,
        email: current.email,
        role: current.role,
        tv: current.tokenVersion,
        typ: 'access' satisfies TokenType,
      },
      {
        secret: this.accessSecret(),
        expiresIn: this.accessDuration().expiresIn,
      },
    );
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (payload?.typ !== 'refresh' || !payload.sub || !payload.jti) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const current = await this.loadSessionUser(payload.sub);
    if (current.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const consumed = await this.prisma.refreshSession.deleteMany({
      where: {
        id: payload.jti,
        userId: current.id,
        expiresAt: { gt: new Date() },
      },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const jti = randomUUID();
    await this.persistRefreshSession(current.id, jti);
    return this.signPair(current, jti);
  }

  setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const configuredSameSite = this.config.get<'lax' | 'none'>(
      'COOKIE_SAME_SITE',
    );
    const accessMaxAge = this.accessDuration().maxAgeMs;
    const refreshMaxAge = this.refreshDuration().maxAgeMs;
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax' | 'none';
      path: string;
    } = {
      httpOnly: true,
      secure: isProd,
      sameSite: configuredSameSite ?? 'lax',
      path: '/',
    };

    res.cookie('LUXTIMEE_access', tokens.accessToken, {
      ...cookieOptions,
      maxAge: accessMaxAge,
    });

    res.cookie('LUXTIMEE_refresh', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: refreshMaxAge,
    });
  }

  clearAuthCookies(res: Response) {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const configuredSameSite = this.config.get<'lax' | 'none'>(
      'COOKIE_SAME_SITE',
    );
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax' | 'none';
      path: string;
    } = {
      httpOnly: true,
      secure: isProd,
      sameSite: configuredSameSite ?? 'lax',
      path: '/',
    };

    res.clearCookie('LUXTIMEE_access', cookieOptions);
    res.clearCookie('LUXTIMEE_refresh', cookieOptions);
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
  }
}
