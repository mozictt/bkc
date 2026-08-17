import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class MasterTenantGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const isMaster = this.tenantContext.getIsMaster();

    if (!isMaster) {
      throw new ForbiddenException('Akses ditolak. Fitur ini hanya untuk Master Tenant.');
    }

    return true;
  }
}
