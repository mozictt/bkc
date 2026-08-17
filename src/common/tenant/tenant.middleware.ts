import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { DataSource } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantService: TenantContextService,
    private readonly dataSource: DataSource,
  ) {}

  async use(req: any, res: any, next: () => void) {
    const authHeader = req.headers.authorization;
    let originTenantId = null;
    let slug = null;
    let role = null;
    let userId = null;

    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        if (token) {
          const decoded: any = jwt.decode(token);  
          originTenantId = decoded?.tenantId || null;
          slug = decoded?.slug || null; 
          role = decoded?.role_id; // Ambil role dari payload JWT
          userId = decoded?.sub || decoded?.userId || null;
        }
      } catch (error) {
        console.error(
          'Error decoding token in TenantMiddleware:',
          error.message,
        );
      }
    }

    let isMaster = false;
    let activeTenantId = originTenantId;

    // Cek apakah origin tenant adalah Master Tenant
    if (originTenantId) {
      try {
        const tenantRepo = this.dataSource.getRepository(Tenant);
        const tenantObj = await tenantRepo.findOne({ where: { id: originTenantId } });
        if (tenantObj?.isMaster || originTenantId === '00000000-0000-0000-0000-000000000000') {
          isMaster = true;
        }
      } catch (err) {
        console.error('[TenantMiddleware] Error checking master tenant:', err?.message);
      }
    }

    const targetTenantHeader = req.headers['x-target-tenant-id'] as string;

    if (targetTenantHeader) {
      if (isMaster) {
        activeTenantId = targetTenantHeader.trim();
      } else {
        throw new ForbiddenException('Akses pengubahan konteks tenant ditolak (hanya untuk Master Tenant).');
      }
    }

    this.tenantService.run(
      activeTenantId,
      slug,
      role,
      userId,
      () => {
        next();
      },
      isMaster,
      originTenantId,
    );
  }
}

