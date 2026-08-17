import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class MasterTenantGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const isMaster = this.tenantContext.getIsMaster();
    const role = this.tenantContext.getRole();

    // Wajib berasal dari Master Tenant DAN memiliki role Super Admin
    if (!isMaster || String(role) !== 'Super Admin') {
      throw new ForbiddenException('Akses ditolak. Fitur ini hanya untuk Super Admin di Master Tenant.');
    }

    return true;
  }
}
