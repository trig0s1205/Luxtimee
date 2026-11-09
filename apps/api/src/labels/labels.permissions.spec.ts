import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { LabelsController } from './labels.controller';

describe('LabelsController permisos', () => {
  it('roles exactos ADMIN y SUPER_ADMIN', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, LabelsController);
    expect(roles).toEqual([Role.ADMIN, Role.SUPER_ADMIN]);
  });

  it('RolesGuard niega a VENDEDOR_LOCAL', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);
    const ctx = {
      getHandler: () => LabelsController.prototype.pdf,
      getClass: () => LabelsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: Role.VENDEDOR_LOCAL } }),
      }),
    };
    expect(() => guard.canActivate(ctx as never)).toThrow(/permisos/);
  });
});

