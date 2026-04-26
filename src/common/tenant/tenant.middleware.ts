import { Injectable, NestMiddleware } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantContextService) {}

  use(req: any, res: any, next: () => void) {
    // Ambil tenantId dari header 'x-tenant-id'
    // const tenantId = req.headers['x-tenant-id'];
    // // console.log('tenantId:',tenantId);
    // // Bungkus eksekusi selanjutnya dalam storage
    // this.tenantService.run(tenantId, () => {
    //   next();
    // });
    const authHeader = req.headers.authorization;
    let tenantId = null; 
    let role = null;

    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        if (token) {
          const decoded: any = jwt.decode(token);
          tenantId = decoded?.tenantId;
          role = decoded?.role; // Ambil role dari payload JWT 
        }
      } catch (error) {
        console.error(
          'Error decoding token in TenantMiddleware:',
          error.message,
        );
      } 
    }

    // Tetap panggil .run agar context storage aktif meskipun tenantId kosong/null
    this.tenantService.run(tenantId, role, () => {
      next();
    });
  }
}
