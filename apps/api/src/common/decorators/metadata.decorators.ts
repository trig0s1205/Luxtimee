import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AUDIT_KEY = 'audit';
export const Audit = (action: string, entity: string) =>
  SetMetadata(AUDIT_KEY, { action, entity });

export const FINANCIAL_KEY = 'financial';
export const Financial = () => SetMetadata(FINANCIAL_KEY, true);
