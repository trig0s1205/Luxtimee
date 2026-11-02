import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { of, lastValueFrom } from 'rxjs';
import { AuditController } from '../../audit/audit.controller';
import { DashboardsController } from '../../dashboards/dashboards.controller';
import { ProductsController } from '../../products/products.controller';
import { SettingsController } from '../../settings/settings.controller';
import { WatchesController } from '../../watches/watches.controller';
import { FinancialStripInterceptor } from '../interceptors/financial-strip.interceptor';
import { FinancialGuard } from './financial.guard';
import { RolesGuard } from './roles.guard';

function context(
  controller: new (...args: never[]) => object,
  method: (...args: never[]) => unknown,
  role?: Role,
) {
  return {
    getClass: () => controller,
    getHandler: () => method,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  };
}

describe('paridad de secretaría (ADMIN) frente al dueño', () => {
  const roles = new RolesGuard(new Reflector());
  const financial = new FinancialGuard(new Reflector());

  function allows(controller: new (...args: never[]) => object, method: (...args: never[]) => unknown, role: Role) {
    const ctx = context(controller, method, role);
    expect(roles.canActivate(ctx as never)).toBe(true);
    expect(financial.canActivate(ctx as never)).toBe(true);
  }

  function denies(controller: new (...args: never[]) => object, method: (...args: never[]) => unknown, role: Role) {
    const ctx = context(controller, method, role);
    expect(() => {
      roles.canActivate(ctx as never);
      financial.canActivate(ctx as never);
    }).toThrow(ForbiddenException);
  }

  it('ADMIN opera inventario, carga masiva, plataforma, envíos y auditoría', () => {
    allows(WatchesController, WatchesController.prototype.bulkDraft, Role.ADMIN);
    allows(WatchesController, WatchesController.prototype.findPendingCost, Role.ADMIN);
    allows(WatchesController, WatchesController.prototype.findPendingInfo, Role.ADMIN);
    allows(SettingsController, SettingsController.prototype.setWhatsapp, Role.ADMIN);
    allows(SettingsController, SettingsController.prototype.getPlatform, Role.ADMIN);
    allows(SettingsController, SettingsController.prototype.setPlatform, Role.ADMIN);
    allows(AuditController, AuditController.prototype.logs, Role.ADMIN);
  });

  it('ADMIN no entra a Ganancias ni a sus ajustes', () => {
    denies(DashboardsController, DashboardsController.prototype.profit, Role.ADMIN);
    denies(DashboardsController, DashboardsController.prototype.exportExcel, Role.ADMIN);
    denies(DashboardsController, DashboardsController.prototype.exportPdf, Role.ADMIN);
    denies(SettingsController, SettingsController.prototype.getProfit, Role.ADMIN);
    denies(SettingsController, SettingsController.prototype.setProfit, Role.ADMIN);
    denies(SettingsController, SettingsController.prototype.getCommission, Role.ADMIN);
    denies(SettingsController, SettingsController.prototype.setCommission, Role.ADMIN);
    denies(ProductsController, ProductsController.prototype.financialSummary, Role.ADMIN);
  });

  it('SUPER_ADMIN sigue entrando al dashboard de ganancia', () => {
    allows(DashboardsController, DashboardsController.prototype.profit, Role.SUPER_ADMIN);
    allows(SettingsController, SettingsController.prototype.getProfit, Role.SUPER_ADMIN);
  });
});

describe('FinancialStripInterceptor', () => {
  const interceptor = new FinancialStripInterceptor();

  async function strip(role?: Role) {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    };
    const next = { handle: () => of({ model: 'Sub', cost: 1000, profitPercent: 40, stock: 1 }) };
    return lastValueFrom(interceptor.intercept(ctx as never, next));
  }

  it('muestra costo al personal y lo oculta al público', async () => {
    await expect(strip(Role.ADMIN)).resolves.toMatchObject({ cost: 1000, profitPercent: 40 });
    await expect(strip(Role.SUPER_ADMIN)).resolves.toMatchObject({ cost: 1000 });
    await expect(strip(Role.CUSTOMER)).resolves.toEqual({ model: 'Sub', stock: 1 });
    await expect(strip()).resolves.toEqual({ model: 'Sub', stock: 1 });
  });
});
