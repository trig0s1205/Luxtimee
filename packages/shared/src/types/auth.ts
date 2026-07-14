import type { Role } from '../index.js';

export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
}

export interface AuthSessionDto {
  user: AuthUserDto;
}
