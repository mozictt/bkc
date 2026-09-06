import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default_secret',
    });
  }

  async validate(payload: any) {
    if (payload.tenantExpiredAt) {
       const now = new Date();
       const expiredDate = new Date(payload.tenantExpiredAt);
       if (now > expiredDate) {
         throw new UnauthorizedException('Sesi dihentikan: Akses Tenant kedaluwarsa.');
       }
    }

    return {
      userId: payload.sub,
      username: payload.username,
      tenantId: payload.tenantId,
      role_id: payload.role_id,
      role: payload.role,
      slug: payload.slug,
      isImpersonated: payload.isImpersonated || false,
      impersonator: payload.impersonator || null,
    };
  }
}
