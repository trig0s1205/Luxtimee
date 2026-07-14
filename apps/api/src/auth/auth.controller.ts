import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
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
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

class MockLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
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
    res.redirect(`${frontend}/cuenta`);
  }

  @Public()
  @Post('mock-login')
  async mockLogin(@Body() dto: MockLoginDto, @Res({ passthrough: true }) res: Response) {
    if (this.config.get('USE_MOCKS') !== 'true') {
      throw new UnauthorizedException('Mock login deshabilitado');
    }

    const user = await this.authService.mockLogin(dto.email, dto.name, dto.role);
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
  async me(@CurrentUser() user: { id: string; email: string; name: string; role: Role }) {
    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookies(res);
    return { ok: true };
  }
}
