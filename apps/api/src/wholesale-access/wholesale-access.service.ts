import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateWholesaleAccessDto,
  UpdateWholesaleAccessDto,
  WholesaleAccessDto,
  WholesaleSessionDto,
} from '@luxtime/shared';
import { WHOLESALE_ACCESS_COOKIE, DEFAULT_WHOLESALE_COOKIE_DAYS } from '@luxtime/shared';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class WholesaleAccessService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private buildAccessUrl(token: string) {
    const base = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    return `${base.replace(/\/$/, '')}/mayoristas/acceso/${token}`;
  }

  private mapRecord(
    record: Prisma.WholesaleAccessGetPayload<object>,
  ): WholesaleAccessDto {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
      accessToken: record.accessToken,
      isActive: record.isActive,
      grantedAt: record.grantedAt.toISOString(),
      revokedAt: record.revokedAt?.toISOString() ?? null,
      lastAccessAt: record.lastAccessAt?.toISOString() ?? null,
      notes: record.notes,
      accessUrl: this.buildAccessUrl(record.accessToken),
      cookieDurationDays: record.cookieDurationDays,
    };
  }

  async list() {
    const [items, total] = await Promise.all([
      this.prisma.wholesaleAccess.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.wholesaleAccess.count(),
    ]);
    return {
      items: items.map((item) => this.mapRecord(item)),
      total,
    };
  }

  async create(dto: CreateWholesaleAccessDto, grantedById?: string) {
    const email = dto.email.trim().toLowerCase();
    const token = randomBytes(24).toString('hex');
    const record = await this.prisma.wholesaleAccess.create({
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone?.trim() || null,
        notes: dto.notes?.trim() || null,
        accessToken: token,
        cookieDurationDays: dto.cookieDurationDays ?? DEFAULT_WHOLESALE_COOKIE_DAYS,
        grantedById,
      },
    });
    return this.mapRecord(record);
  }

  async update(id: string, dto: UpdateWholesaleAccessDto) {
    const existing = await this.prisma.wholesaleAccess.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Acceso mayorista no encontrado');

    const record = await this.prisma.wholesaleAccess.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        ...(dto.isActive !== undefined
          ? {
              isActive: dto.isActive,
              revokedAt: dto.isActive ? null : new Date(),
            }
          : {}),
        ...(dto.cookieDurationDays !== undefined
          ? { cookieDurationDays: dto.cookieDurationDays }
          : {}),
      },
    });
    return this.mapRecord(record);
  }

  async revoke(id: string) {
    return this.update(id, { isActive: false });
  }

  async activateSession(token: string, res: Response): Promise<WholesaleSessionDto> {
    const record = await this.prisma.wholesaleAccess.findUnique({
      where: { accessToken: token },
    });
    if (!record || !record.isActive) {
      throw new UnauthorizedException('Enlace mayorista inválido o revocado');
    }

    await this.prisma.wholesaleAccess.update({
      where: { id: record.id },
      data: { lastAccessAt: new Date() },
    });

    const isProd = this.config.get('NODE_ENV') === 'production';
    const maxAge = (record.cookieDurationDays ?? DEFAULT_WHOLESALE_COOKIE_DAYS) * MS_PER_DAY;
    res.cookie(WHOLESALE_ACCESS_COOKIE, record.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    return {
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
    };
  }

  clearSession(res: Response) {
    res.clearCookie(WHOLESALE_ACCESS_COOKIE, { path: '/' });
  }

  async getSessionFromToken(token?: string | null): Promise<WholesaleSessionDto | null> {
    if (!token) return null;
    const record = await this.prisma.wholesaleAccess.findUnique({
      where: { accessToken: token },
    });
    if (!record || !record.isActive) return null;
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
    };
  }

  async requireAccessFromToken(token?: string | null) {
    const session = await this.getSessionFromToken(token);
    if (!session) {
      throw new UnauthorizedException('Acceso mayorista requerido');
    }
    return session;
  }

  async regenerateToken(id: string) {
    const existing = await this.prisma.wholesaleAccess.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Acceso mayorista no encontrado');
    const token = randomBytes(24).toString('hex');
    const record = await this.prisma.wholesaleAccess.update({
      where: { id },
      data: { accessToken: token, isActive: true, revokedAt: null },
    });
    return this.mapRecord(record);
  }
}
