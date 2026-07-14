import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: config.get<string>('GOOGLE_OAUTH_CLIENT_ID') || 'mock-client-id',
      clientSecret: config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') || 'mock-secret',
      callbackURL: config.get<string>('GOOGLE_OAUTH_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('Google no devolvió email'), undefined);
    }

    const user = await this.authService.validateGoogleUser({
      googleId: profile.id,
      email,
      name: profile.displayName || email,
    });

    done(null, user);
  }
}
