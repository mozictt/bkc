import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantContextService } from '../tenant/tenant-context.service';
import { DataSource } from 'typeorm';
import { Role } from '../../role/entities/role.entity';

@Injectable()
export class MasterTenantGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isMaster = this.tenantContext.getIsMaster();
    let role = this.tenantContext.getRole();
    const roleId = this.tenantContext.getRoleId();
    const request = context.switchToHttp().getRequest();

    // Jika nama role belum terisi tapi roleId ada (legacy token), resolve nama role dari DB
    if (!role && roleId) {
      try {
        const roleRepo = this.dataSource.getRepository(Role);
        const roleEntity = await roleRepo.findOne({ where: { id: +roleId } });
        if (roleEntity) {
          role = roleEntity.name;
        }
      } catch (err) {
        console.error('[MasterTenantGuard] Gagal mengambil role dari database:', err?.message);
      }
    }

    if (!role && request.user?.role) {
      role = request.user.role;
    }

    // Wajib berasal dari Master Tenant DAN memiliki role 'Super Admin'
    if (!isMaster || String(role).trim().toLowerCase() !== 'super admin') {
      throw new ForbiddenException('Akses ditolak. Fitur ini hanya untuk Super Admin di Master Tenant.');
    }

    return true;
  }
}
