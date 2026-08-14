import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/metadata.decorators';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import {
  ChangeEmailDto,
  ChangePasswordDto,
  LoginCredentialsDto,
  UpdateProfileDto,
} from './dto/auth-account.dto';

class MockLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}

class RefreshTokenDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
    private jwtService: JwtService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    return { message: 'Redirigiendo a Google OAuth' };
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as { id: string; email: string; role: Role };
    const tokens = await this.authService.issueTokens(user);
    this.authService.setAuthCookies(res, tokens);

    const frontend = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const slug = this.config.get<string>('STAFF_LOGIN_SLUG', 'dev-portal-lx9k2');
    res.redirect(`${frontend}/acceso/${slug}/exito`);
  }

  @Public()
  @Get('config')
  authConfig() {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const clientId = this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID', '');
    return {
      googleEnabled: Boolean(clientId && clientId !== 'mock-client-id'),
      mockEnabled: !isProd && this.config.get('USE_MOCKS') === 'true',
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async loginWithCredentials(
    @Body() dto: LoginCredentialsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientIp = typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : req.ip;
    const user = await this.authService.loginWithPassword(dto.email, dto.password, clientIp);
    const tokens = await this.authService.issueTokens(user);
    this.authService.setAuthCookies(res, tokens);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('mock-login')
  async mockLogin(@Body() dto: MockLoginDto, @Res({ passthrough: true }) res: Response) {
    if (this.config.get('NODE_ENV') === 'production') {
      throw new NotFoundException();
    }
    if (this.config.get('USE_MOCKS') !== 'true') {
      throw new UnauthorizedException('Mock login deshabilitado');
    }

    const user = await this.authService.mockLogin(dto.email, dto.name);
    const tokens = await this.authService.issueTokens(user);
    this.authService.setAuthCookies(res, tokens);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.LUXTIMEE_refresh ?? dto.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token no encontrado');
    }

    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      const user = await this.authService.getUserById(payload.sub);
      if (!user) {
        throw new UnauthorizedException();
      }

      const tokens = await this.authService.issueTokens(user);
      this.authService.setAuthCookies(res, tokens);
      return {
        ok: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  @Get('me')
  async me(@CurrentUser() user: { id: string; email: string; name: string; role: Role; phone?: string | null }) {
    return { user };
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.authService.updateProfile(user.id, dto);
    return { user: updated };
  }

  @Patch('me/email')
  async changeEmail(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangeEmailDto,
  ) {
    const updated = await this.authService.changeEmail(user.id, dto.email, dto.currentPassword);
    return { user: updated };
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    const updated = await this.authService.changePassword(user.id, dto.newPassword, dto.currentPassword);
    return { user: updated };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookies(res);
    return { ok: true };
  }
}
