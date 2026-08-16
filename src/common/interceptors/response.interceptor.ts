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

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        // Jangan bungkus jika yang di-return adalah StreamableFile (Gambar/Video/Dokumen)
        if (data instanceof StreamableFile) {
          return data;
        }

        // Deteksi apakah response data berupa paginasi
        const isPaginated =
          data &&
          typeof data === 'object' &&
          (Array.isArray(data.items) || Array.isArray(data.array)) &&
          (data.totalItems !== undefined ||
            data.meta !== undefined ||
            data.total !== undefined ||
            data.totalPages !== undefined);

        if (isPaginated) {
          const items = data.items || data.array || [];
          const totalItems =
            data.totalItems ??
            data.total ??
            data.meta?.totalItems ??
            items.length;
          
          const currentPage =
            data.currentPage ??
            data.meta?.currentPage ??
            (Number(request.query?.page) || 1);

          const itemsPerPage =
            data.limit ??
            data.itemsPerPage ??
            data.meta?.itemsPerPage ??
            (Number(request.query?.limit) || Number(request.query?.rowsPerPage) || 10);

          const totalPages =
            data.totalPages ??
            data.meta?.totalPages ??
            (Math.ceil(totalItems / itemsPerPage) || 1);

          const itemCount = items.length;

          return {
            success: true,
            statusCode,
            message,
            data: {
              items,
              meta: {
                totalItems,
                itemCount,
                itemsPerPage,
                totalPages,
                currentPage,
              },
            },
          };
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
