import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Role } from '@prisma/client';

const FINANCIAL_FIELDS = [
  'cost',
  'profitPercent',
  'retailMarginPercentage',
  'wholesaleMarginPercentage',
  'secretaryCommissionPercentage',
] as const;

function stripFinancial<T>(data: T, role?: Role): T {
  if (!data || role === Role.SUPER_ADMIN) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => stripFinancial(item, role)) as T;
  }

  if (typeof data === 'object') {
    const copy = { ...(data as Record<string, unknown>) };
    for (const field of FINANCIAL_FIELDS) {
      delete copy[field];
    }

    for (const key of Object.keys(copy)) {
      copy[key] = stripFinancial(copy[key], role);
    }

    return copy as T;
  }

  return data;
}

@Injectable()
export class FinancialStripInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const role: Role | undefined = request.user?.role;

    return next.handle().pipe(map((data) => stripFinancial(data, role)));
  }
}
