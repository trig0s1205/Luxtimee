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
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthRefreshDto {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthConfigDto {
  googleEnabled: boolean;
  mockEnabled: boolean;
}
