import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityLogsService } from '../activity-logs.service';
import { LOG_ACTIVITY_KEY, LogActivityOptions } from '../decorators/log-activity.decorator';
import { sanitizePayload } from '../utils/sanitize-payload.util';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    // Ambil opsi metadata @LogActivity() jika ada
    const metaOptions = this.reflector.getAllAndOverride<LogActivityOptions>(
      LOG_ACTIVITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    // Jangan rekam GET request biasa kecuali diberi decorator @LogActivity() eksplisit
    if (!isWriteMethod && !metaOptions) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.logRequest(request, method, metaOptions, data, false);
        },
        error: (err) => {
          this.logRequest(request, method, metaOptions, err, true);
        },
      }),
    );
  }

  private logRequest(
    request: any,
    method: string,
    metaOptions?: LogActivityOptions,
    responseOrError?: any,
    isError = false,
  ) {
    try {
      const user = request.user;
      const path = request.originalUrl || request.url;
      const rawIp =
        request.headers['x-forwarded-for'] ||
        request.connection?.remoteAddress ||
        request.ip;
      const ipAddress = Array.isArray(rawIp) ? rawIp[0] : rawIp;
      const userAgent = request.headers['user-agent'];

      // Determinasi Modul & Action secara otomatis
      const pathSegments = path.split('?')[0].split('/').filter(Boolean);
      // Abaikan prefix 'api' atau versi jika ada
      const filteredSegments = pathSegments.filter(s => !['api', 'v1', 'v2'].includes(s));
      const defaultModule =
        metaOptions?.module ||
        (filteredSegments.length > 0 ? filteredSegments[0].toUpperCase() : 'SYSTEM');

      let defaultAction = metaOptions?.action;
      if (!defaultAction) {
        switch (method) {
          case 'POST':
            defaultAction = 'CREATE';
            break;
          case 'PUT':
          case 'PATCH':
            defaultAction = 'UPDATE';
            break;
          case 'DELETE':
            defaultAction = 'DELETE';
            break;
          default:
            defaultAction = 'READ';
        }
      }

      const statusText = isError ? '[GAGAL]' : '[SUKSES]';
      const description =
        metaOptions?.description ||
        `${statusText} ${method} ${path} oleh ${user?.username || 'Guest'}`;

      // Gabungkan Route Params & Query Params, lalu Sanitasi
      const combinedParams = {
        ...(request.params || {}),
        ...(request.query || {}),
      };
      const sanitizedParams = Object.keys(combinedParams).length > 0
        ? sanitizePayload(combinedParams)
        : null;

      // Sanitasi Request Body
      const sanitizedBody = request.body
        ? sanitizePayload(request.body)
        : null;

      this.activityLogsService.createLog({
        tenantId: user?.tenantId || request.headers['x-tenant-id'] || null,
        userId: user?.userId || user?.id || null,
        username: user?.username || 'Guest',
        action: defaultAction,
        module: defaultModule,
        description: description,
        ipAddress: String(ipAddress || ''),
        userAgent: String(userAgent || ''),
        method: method,
        path: path,
        params: sanitizedParams,
        body: sanitizedBody,
      });
    } catch (err) {
      console.error('Error recording activity log:', err);
    }
  }
}
