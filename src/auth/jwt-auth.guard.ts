import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // skip auth
    }

    return super.canActivate(context);
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
