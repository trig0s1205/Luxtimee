import {
  Body,
  Controller,
  Get,
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
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/metadata.decorators';
import { IsEmail, IsString, MinLength } from 'class-validator';
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
    res.redirect(`${frontend}/ingresar/exito`);
  }

  @Public()
  @Get('config')
  authConfig() {
    const clientId = this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID', '');
    return {
      googleEnabled: Boolean(clientId && clientId !== 'mock-client-id'),
      mockEnabled: this.config.get('USE_MOCKS') === 'true',
    };
  }

  @Public()
  @Post('login')
  async loginWithCredentials(
    @Body() dto: LoginCredentialsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.loginWithPassword(dto.email, dto.password);
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
    };
  }

  @Public()
  @Post('mock-login')
  async mockLogin(@Body() dto: MockLoginDto, @Res({ passthrough: true }) res: Response) {
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
    };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.luxtime_refresh;
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
      return { ok: true };
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
