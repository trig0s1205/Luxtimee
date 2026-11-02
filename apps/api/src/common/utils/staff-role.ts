import { Role } from '@prisma/client';

export function isStaffRole(role?: Role | null) {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

export function isOwnerRole(role?: Role | null) {
  return role === Role.SUPER_ADMIN;
}
