import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @InjectRedis() private readonly redis: Redis,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // skip auth
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const queryToken = request.query?.token as string;
    const token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.split(' ')[1]
      : queryToken;

    if (token) {
      // Cek apakah token ada di blacklist (Redis)
      const isBlacklisted = await this.redis.get(`blacklist_token:${token}`);
      if (isBlacklisted) {
        throw new UnauthorizedException({
          success: false,
          message: 'Token sudah tidak berlaku (Logged out)',
        });
      }
    }

    return (await super.canActivate(context)) as boolean;
  }

  handleRequest(err: any, user: any, info: any) {
    // console.log(info);
    if (info?.name === 'TokenExpiredError') {
      throw new UnauthorizedException({
        success: false,
        message: 'Token sudah expired, silakan login kembali',
      });
    }

    if (info?.name === 'JsonWebTokenError') {
      throw new UnauthorizedException({
        success: false,
        message: 'Token tidak valid',
      });
    }

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        message: 'Token tidak ditemukan',
      });
    }

    return user;
  }
}
