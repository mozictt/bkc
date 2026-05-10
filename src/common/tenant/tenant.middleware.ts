import { Injectable, NestMiddleware } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantContextService) {}

  use(req: any, res: any, next: () => void) {
    const authHeader = req.headers.authorization;
    let tenantId = null;
    let role = null;

    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        if (token) {
          const decoded: any = jwt.decode(token);
          tenantId = decoded?.tenantId || null;
          role = decoded?.role; // Ambil role dari payload JWT
        }
      } catch (error) {
        console.error(
          'Error decoding token in TenantMiddleware:',
          error.message,
        );
      }
    }

    this.tenantService.run(tenantId, role, () => {
      next();
    });
  }
}
