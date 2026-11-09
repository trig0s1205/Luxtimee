/**
 * Controllers sin @Roles que exponen datos internos (no modificar aquí):
 * - AppController (GET /): autenticado vía JwtAuthGuard global, sin RolesGuard
 * - CronController (internal/cron): sin @Roles; protege con CRON_SECRET
 * - AuthController: endpoints de sesión/perfil autenticados sin @Roles (auto-servicio)
 */
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { firstValueFrom, of } from 'rxjs';
import { assertStaffRole } from '../auth/auth.service';
import { ROLES_KEY } from '../common/decorators/metadata.decorators';
import { FinancialGuard } from '../common/guards/financial.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialStripInterceptor } from '../common/interceptors/financial-strip.interceptor';
import { ReceiptsController } from '../receipts/receipts.controller';
import { WatchesController } from '../watches/watches.controller';

jest.mock('../dashboards/dashboards.service', () => ({
  DashboardsService: class DashboardsService {},
}));
jest.mock('../integrations/reports.service', () => ({
  ReportsService: class ReportsService {},
}));
jest.mock('../integrations/ga4.service', () => ({
  Ga4Service: class Ga4Service {},
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DashboardsController } = require('../dashboards/dashboards.controller') as {
  DashboardsController: typeof import('../dashboards/dashboards.controller').DashboardsController;
};

function httpContext(
  role: Role | undefined,
  handler: (...args: never[]) => unknown,
  controller: new (...args: never[]) => unknown,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('pos permissions — VENDEDOR_LOCAL', () => {
  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);
  const financialGuard = new FinancialGuard(reflector);
  const stripInterceptor = new FinancialStripInterceptor();

  it('RolesGuard niega VENDEDOR_LOCAL en [ADMIN, SUPER_ADMIN]', () => {
    const ctx = httpContext(
      Role.VENDEDOR_LOCAL,
      WatchesController.prototype.findAll,
      WatchesController,
    );
    expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('RolesGuard permite VENDEDOR_LOCAL en [ADMIN, SUPER_ADMIN, VENDEDOR_LOCAL]', () => {
    const ctx = httpContext(
      Role.VENDEDOR_LOCAL,
      ReceiptsController.prototype.getOne,
      ReceiptsController,
    );
    expect(rolesGuard.canActivate(ctx)).toBe(true);
  });

  it('FinancialGuard niega VENDEDOR_LOCAL y ADMIN', () => {
    const forRole = (role: Role) =>
      httpContext(
        role,
        DashboardsController.prototype.profit,
        DashboardsController,
      );
    expect(() => financialGuard.canActivate(forRole(Role.VENDEDOR_LOCAL))).toThrow(
      ForbiddenException,
    );
    expect(() => financialGuard.canActivate(forRole(Role.ADMIN))).toThrow(
      ForbiddenException,
    );
  });

  it('FinancialStripInterceptor quita cost para VENDEDOR_LOCAL', async () => {
    const ctx = httpContext(
      Role.VENDEDOR_LOCAL,
      WatchesController.prototype.findAll,
      WatchesController,
    );
    const next = { handle: () => of({ id: 'w1', cost: 150_000, name: 'Demo' }) };
    const result = await firstValueFrom(stripInterceptor.intercept(ctx, next));
    expect(result).toEqual({ id: 'w1', name: 'Demo' });
  });

  it('assertStaffRole acepta VENDEDOR_LOCAL y rechaza CUSTOMER', () => {
    expect(() => assertStaffRole(Role.VENDEDOR_LOCAL)).not.toThrow();
    expect(() => assertStaffRole(Role.CUSTOMER)).toThrow(UnauthorizedException);
  });

  it('Reflect.getMetadata(ROLES_KEY, DashboardsController) / profit method does NOT include VENDEDOR_LOCAL', () => {
    const classRoles = Reflect.getMetadata(ROLES_KEY, DashboardsController) as Role[];
    const profitRoles = Reflect.getMetadata(
      ROLES_KEY,
      DashboardsController.prototype.profit,
    ) as Role[];
    expect(classRoles).not.toContain(Role.VENDEDOR_LOCAL);
    expect(profitRoles).not.toContain(Role.VENDEDOR_LOCAL);
  });
});
