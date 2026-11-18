import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseOrigin, Prisma } from '@prisma/client';
import { sanitizePlainText } from '../common/utils/sanitize-text.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

const expenseInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

export type ExpensePeriod = 'day' | 'week' | 'month' | 'all';

function emptyOriginTotals(): { PLATAFORMA: number; LOCAL: number } {
  return { PLATAFORMA: 0, LOCAL: 0 };
}

function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function expenseDate(value?: string | null) {
  const raw = value?.trim() || bogotaToday();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) throw new BadRequestException('La fecha no es válida');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException('La fecha no es válida');
  }
  return date;
}

function periodStart(period: ExpensePeriod) {
  if (period === 'all') return null;
  const [year, month, day] = bogotaToday().split('-').map(Number);
  if (period === 'day') return new Date(Date.UTC(year, month - 1, day));
  if (period === 'week') return new Date(Date.UTC(year, month - 1, day - 6));
  return new Date(Date.UTC(year, month - 1, 1));
}

function toOriginTotals(
  rows: Array<{ origin: ExpenseOrigin; _sum: { amount: number | null } }>,
) {
  const totals = emptyOriginTotals();
  for (const row of rows) {
    totals[row.origin] = row._sum.amount ?? 0;
  }
  return totals;
}

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  private map(expense: ExpenseRow) {
    return {
      id: expense.id,
      name: expense.name,
      description: expense.description,
      amount: expense.amount,
      spentAt: expense.spentAt.toISOString(),
      origin: expense.origin,
      createdById: expense.createdById,
      createdByName: expense.createdBy?.name ?? null,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
    };
  }

  private cleanName(value: string) {
    const name = sanitizePlainText(value, 120);
    if (!name) throw new BadRequestException('El nombre es obligatorio');
    return name;
  }

  private cleanAmount(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException('El valor debe ser mayor a 0');
    }
    return value;
  }

  private cleanOrigin(value?: string | null): ExpenseOrigin | undefined {
    if (value == null) return undefined;
    if (value === ExpenseOrigin.PLATAFORMA || value === ExpenseOrigin.LOCAL) return value;
    throw new BadRequestException('El origen no es válido');
  }

  async findAll(query: {
    search?: string;
    from?: string;
    to?: string;
    origin?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(100, query.limit ?? 20);
    const search = query.search?.trim();
    const origin = this.cleanOrigin(query.origin);
    const spentAt: Prisma.DateTimeFilter = {};
    if (query.from) spentAt.gte = expenseDate(query.from);
    if (query.to) spentAt.lte = expenseDate(query.to);
    if (spentAt.gte && spentAt.lte && spentAt.gte > spentAt.lte) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final');
    }

    const baseWhere: Prisma.ExpenseWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.from || query.to ? { spentAt } : {}),
    };
    const where: Prisma.ExpenseWhereInput = {
      ...baseWhere,
      ...(origin ? { origin } : {}),
    };

    const [total, rows, amountAgg, originGroups] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
      this.prisma.expense.groupBy({
        by: ['origin'],
        where: baseWhere,
        _sum: { amount: true },
      }),
    ]);

    return {
      items: rows.map((row) => this.map(row)),
      total,
      page,
      limit,
      totalAmount: amountAgg._sum.amount ?? 0,
      totalsByOrigin: toOriginTotals(originGroups),
    };
  }

  async summary(period: ExpensePeriod = 'month', origin?: string) {
    const since = periodStart(period);
    const originFilter = this.cleanOrigin(origin);
    const periodWhere: Prisma.ExpenseWhereInput = since ? { spentAt: { gte: since } } : {};
    const where: Prisma.ExpenseWhereInput = {
      ...periodWhere,
      ...(originFilter ? { origin: originFilter } : {}),
    };
    const [total, count, rows, originGroups] = await Promise.all([
      this.prisma.expense.aggregate({ where, _sum: { amount: true } }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.expense.groupBy({
        by: ['origin'],
        where: periodWhere,
        _sum: { amount: true },
      }),
    ]);
    return {
      period,
      total: total._sum.amount ?? 0,
      count,
      items: rows.map((row) => this.map(row)),
      byOrigin: toOriginTotals(originGroups),
    };
  }

  async create(dto: CreateExpenseDto, createdById?: string) {
    const name = this.cleanName(dto.name);
    const amount = this.cleanAmount(dto.amount);
    const spentAt = expenseDate(dto.spentAt);
    const description = sanitizePlainText(dto.description ?? '', 500) || null;
    const origin = this.cleanOrigin(dto.origin) ?? ExpenseOrigin.PLATAFORMA;
    const expense = await this.prisma.expense.create({
      data: {
        name,
        description,
        amount,
        spentAt,
        origin,
        createdById: createdById ?? null,
      },
      include: expenseInclude,
    });
    return this.map(expense);
  }

  async update(id: string, dto: UpdateExpenseDto) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gasto no encontrado');

    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: this.cleanName(dto.name) } : {}),
        ...(dto.description !== undefined
          ? { description: sanitizePlainText(dto.description ?? '', 500) || null }
          : {}),
        ...(dto.amount !== undefined ? { amount: this.cleanAmount(dto.amount) } : {}),
        ...(dto.spentAt !== undefined ? { spentAt: expenseDate(dto.spentAt) } : {}),
        ...(dto.origin !== undefined ? { origin: this.cleanOrigin(dto.origin)! } : {}),
      },
      include: expenseInclude,
    });
    return this.map(expense);
  }

  async remove(id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gasto no encontrado');
    await this.prisma.expense.delete({ where: { id } });
    return { id, deleted: true };
  }
}
