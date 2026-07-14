import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { FINANCIAL_KEY } from '../decorators/metadata.decorators';

@Injectable()
export class FinancialGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isFinancial = this.reflector.getAllAndOverride<boolean>(FINANCIAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isFinancial) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Solo Super Admin puede acceder a información financiera');
    }

    return true;
  }
}
