import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '@entities/permission.entity';
import { AccessLevelMapping, PrimitiveAction } from './constants/access-level.constant';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  async checkAccess(
    userId: number,
    roleId: number,
    tenantId: string,
    resource: string,
    action: PrimitiveAction,
  ): Promise<boolean> {
    
    // 1. Check User specific permission first (Override)
    if (userId) {
      const userPermission = await this.permissionRepo.findOne({
        where: { user: { id: userId }, resource, tenantId: tenantId ? tenantId : undefined },
      });

      if (userPermission) {
        const allowedActions = AccessLevelMapping[userPermission.accessLevel] || [];
        if (allowedActions.includes(action) || allowedActions.includes('manage')) {
          return true;
        }
      }
    }

    // 2. Check Role specific permission (Fallback)
    if (roleId) {
      const rolePermission = await this.permissionRepo.findOne({
        where: { role: { id: roleId }, resource, tenantId: tenantId ? tenantId : undefined },
      });

      if (rolePermission) {
        const allowedActions = AccessLevelMapping[rolePermission.accessLevel] || [];
        if (allowedActions.includes(action) || allowedActions.includes('manage')) {
          return true;
        }
      }
    }

    // Default deny
    return false;
  }
}
