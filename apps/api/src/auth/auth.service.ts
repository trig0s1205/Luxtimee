import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

const STAFF_ROLES = new Set<Role>([Role.ADMIN, Role.SUPER_ADMIN]);

@Injectable()
export class AuthService {
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
    const cookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
    };

    res.cookie('luxtime_access', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('luxtime_refresh', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie('luxtime_access', { path: '/' });
    res.clearCookie('luxtime_refresh', { path: '/' });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });
  }
}
