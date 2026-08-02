import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const message =
      this.reflector.get<string>('message', context.getHandler()) || 'OK';

    const statusCode = context.switchToHttp().getResponse().statusCode;

    return next.handle().pipe(
      map((data) => {
        // Jangan bungkus jika yang di-return adalah StreamableFile (Gambar/Video/Dokumen)
        if (data instanceof StreamableFile) {
          return data;
        }

        return {
          success: true,
          statusCode,
          message,
          data,
        };
      }),
    );
  }
}
