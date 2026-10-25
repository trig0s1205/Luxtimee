import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateWholesaleAccessDto,
  UpdateWholesaleAccessDto,
  WholesalerOrderHistoryDto,
  WholesalerReportDto,
  WholesaleAccessDto,
  WholesaleSessionDto,
} from '@luxtime/shared';
import {
  WHOLESALE_ACCESS_COOKIE,
  DEFAULT_WHOLESALE_COOKIE_DAYS,
} from '@luxtime/shared';
import { generateWholesaleToken, hashWholesaleToken } from './wholesale-token';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class WholesaleAccessService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private buildAccessUrl(token: string) {
    const base = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    return `${base.replace(/\/$/, '')}/mayoristas/acceso/${token}`;
  }

  private parseExpiry(value: string | null | undefined) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Fecha de vencimiento inválida');
    }
    return date;
  }

  private isExpired(expiresAt: Date | null) {
    return !!expiresAt && expiresAt.getTime() <= Date.now();
  }

  private mapRecord(
    record: Prisma.WholesaleAccessGetPayload<object>,
    rawToken?: string | null,
  ): WholesaleAccessDto {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
      accessToken: rawToken ?? null,
      isActive: record.isActive,
      grantedAt: record.grantedAt.toISOString(),
      revokedAt: record.revokedAt?.toISOString() ?? null,
      lastAccessAt: record.lastAccessAt?.toISOString() ?? null,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      notes: record.notes,
      accessUrl: rawToken ? this.buildAccessUrl(rawToken) : null,
      cookieDurationDays: record.cookieDurationDays,
    };
  }

  private findByToken(token: string) {
    return this.prisma.wholesaleAccess.findUnique({
      where: { accessTokenHash: hashWholesaleToken(token) },
    });
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

  async report(): Promise<WholesalerReportDto> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        isActive: boolean;
        orders: number;
        units: number;
        revenue: number;
      }>
    >`
      SELECT
        wa.id,
        wa.name,
        wa.email,
        wa.phone,
        wa."isActive" AS "isActive",
        COALESCE(agg.orders, 0)::int AS orders,
        COALESCE(agg.units, 0)::int AS units,
        COALESCE(agg.revenue, 0)::int AS revenue
      FROM "WholesaleAccess" wa
      LEFT JOIN (
        SELECT
          o."wholesaleAccessId" AS id,
          COUNT(*)::int AS orders,
          COALESCE(SUM(o.total), 0)::int AS revenue,
          COALESCE(SUM(item.units), 0)::int AS units
        FROM "Order" o
        LEFT JOIN (
          SELECT "orderId", SUM(quantity)::int AS units
          FROM "OrderItem"
          GROUP BY "orderId"
        ) item ON item."orderId" = o.id
        WHERE o."canceledAt" IS NULL
          AND o.stage::text = 'ORDER'
          AND o."wholesaleAccessId" IS NOT NULL
        GROUP BY o."wholesaleAccessId"
      ) agg ON agg.id = wa.id
      ORDER BY revenue DESC, wa.name ASC
    `;
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        isActive: row.isActive,
        orders: Number(row.orders),
        units: Number(row.units),
        revenue: Number(row.revenue),
      })),
    };
  }

  async listOrders(
    id: string,
    page = 1,
    limit = 20,
  ): Promise<WholesalerOrderHistoryDto> {
    const access = await this.prisma.wholesaleAccess.findUnique({
      where: { id },
    });
    if (!access) {
      throw new NotFoundException('Acceso mayorista no encontrado');
    }
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const where = { wholesaleAccessId: id };
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        select: {
          id: true,
          readableId: true,
          stage: true,
          status: true,
          total: true,
          createdAt: true,
          canceledAt: true,
          suspendedAt: true,
          depositConfirmed: true,
          items: { select: { quantity: true } },
        },
      }),
    ]);
    return {
      items: orders.map((order) => ({
        id: order.id,
        readableId: order.readableId,
        stage: order.stage,
        status: order.status,
        total: order.total,
        units: order.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: order.createdAt.toISOString(),
        canceledAt: order.canceledAt?.toISOString() ?? null,
        suspendedAt: order.suspendedAt?.toISOString() ?? null,
        depositConfirmed: order.depositConfirmed,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async create(dto: CreateWholesaleAccessDto, grantedById?: string) {
    const email = dto.email?.trim().toLowerCase() || null;
    const token = generateWholesaleToken();
    const record = await this.prisma.wholesaleAccess.create({
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone?.trim() || null,
        notes: dto.notes?.trim() || null,
        accessTokenHash: hashWholesaleToken(token),
        expiresAt: this.parseExpiry(dto.expiresAt) ?? null,
        cookieDurationDays:
          dto.cookieDurationDays ?? DEFAULT_WHOLESALE_COOKIE_DAYS,
        grantedById,
      },
    });
    return this.mapRecord(record, token);
  }

  async update(id: string, dto: UpdateWholesaleAccessDto) {
    const existing = await this.prisma.wholesaleAccess.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Acceso mayorista no encontrado');
    }

    const expiresAt = this.parseExpiry(dto.expiresAt);
    const record = await this.prisma.wholesaleAccess.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.email !== undefined
          ? { email: dto.email.trim() ? dto.email.trim().toLowerCase() : null }
          : {}),
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
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      },
    });
    return this.mapRecord(record);
  }

  async revoke(id: string) {
    return this.update(id, { isActive: false });
  }

  async activateSession(
    token: string,
    res: Response,
  ): Promise<WholesaleSessionDto> {
    const record = await this.findByToken(token);
    if (!record || !record.isActive) {
      throw new UnauthorizedException('Enlace mayorista inválido o revocado');
    }
    if (this.isExpired(record.expiresAt)) {
      throw new UnauthorizedException('Enlace mayorista vencido');
    }

    await this.prisma.wholesaleAccess.update({
      where: { id: record.id },
      data: { lastAccessAt: new Date() },
    });

    const isProd = this.config.get('NODE_ENV') === 'production';
    const maxAge =
      (record.cookieDurationDays ?? DEFAULT_WHOLESALE_COOKIE_DAYS) * MS_PER_DAY;
    res.cookie(WHOLESALE_ACCESS_COOKIE, token, {
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

  async getSessionFromToken(
    token?: string | null,
  ): Promise<WholesaleSessionDto | null> {
    if (!token) return null;
    const record = await this.findByToken(token);
    if (!record || !record.isActive || this.isExpired(record.expiresAt)) {
      return null;
    }
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
    const existing = await this.prisma.wholesaleAccess.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Acceso mayorista no encontrado');
    }
    const token = generateWholesaleToken();
    const record = await this.prisma.wholesaleAccess.update({
      where: { id },
      data: {
        accessTokenHash: hashWholesaleToken(token),
        isActive: true,
        revokedAt: null,
      },
    });
    return this.mapRecord(record, token);
  }

  async remove(id: string) {
    const existing = await this.prisma.wholesaleAccess.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Acceso mayorista no encontrado');
    }
    if (existing.isActive) {
      throw new BadRequestException('Revoca el acceso antes de eliminarlo.');
    }

    await this.prisma.$transaction([
      this.prisma.order.updateMany({
        where: { wholesaleAccessId: id },
        data: { wholesaleAccessId: null },
      }),
      this.prisma.wholesaleAccess.delete({ where: { id } }),
    ]);

    return { ok: true };
  }
}
