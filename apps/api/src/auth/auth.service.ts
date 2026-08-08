import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import { hashPassword, verifyPassword } from './password.util';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

const STAFF_ROLES = new Set<Role>([Role.ADMIN, Role.SUPER_ADMIN]);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  private assertStaffRole(role: Role) {
    if (!STAFF_ROLES.has(role)) {
      throw new UnauthorizedException('No tienes acceso al panel de administración');
    }
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
      throw new UnauthorizedException('No tienes acceso al panel de administración');
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
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      this.logFailedLogin(email, clientIp);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    this.assertStaffRole(user.role);
    return user;
  }

  logFailedLogin(email: string, clientIp?: string) {
    const normalized = email.trim().toLowerCase();
    const masked = normalized.includes('@')
      ? `${normalized[0]}***@${normalized.split('@')[1]}`
      : '***';
    this.logger.warn(`Login fallido ip=${clientIp ?? 'unknown'} email=${masked}`);
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
      },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
  }

  async changeEmail(userId: string, email: string, currentPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (user.passwordHash) {
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
        throw new UnauthorizedException('La contraseña actual no es correcta');
      }
    }

    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Ese correo ya está en uso');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { email: normalized },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
  }

  async changePassword(userId: string, newPassword: string, currentPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (user.passwordHash) {
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
        throw new UnauthorizedException('La contraseña actual no es correcta');
      }
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(newPassword) },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
  }

  async mockLogin(email: string, name: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      throw new UnauthorizedException('Solo personal autorizado puede iniciar sesión');
    }

    this.assertStaffRole(existing.role);

    return this.prisma.user.update({
      where: { email },
      data: { name },
    });
  }

  async issueTokens(user: { id: string; email: string; role: Role }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES', '15m'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES', '7d'),
    });

    return { accessToken, refreshToken };
  }

  setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax' | 'none';
      path: string;
    } = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };

    res.cookie('LUXTIMEE_access', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('LUXTIMEE_refresh', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie('LUXTIMEE_access', { path: '/' });
    res.clearCookie('LUXTIMEE_refresh', { path: '/' });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
  }
}
