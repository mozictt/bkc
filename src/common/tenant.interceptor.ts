import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant/tenant-context.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = user?.tenantId;

    if (tenantId) {
      // Jalankan request di dalam context AsyncLocalStorage
      return new Observable((observer) => {
        return this.tenantContextService.run(String(tenantId), () => {
          return next.handle().subscribe(observer);
        });
      });
    }

    return next.handle();
  }
}