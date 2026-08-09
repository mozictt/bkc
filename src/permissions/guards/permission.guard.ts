import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionService } from '../permission.service';
import { PrimitiveAction } from '../constants/access-level.constant';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Ambil metadata permission dari decorator
    const requiredPermission = this.reflector.getAllAndOverride<{
      resource: string;
      action: PrimitiveAction;
    }>(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermission) {
      // Jika endpoint tidak memiliki decorator @RequirePermission, biarkan lewat
      return true;
    }

    const { resource, action } = requiredPermission;
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Dari JwtAuthGuard

    if (!user) {
      throw new ForbiddenException('Akses ditolak: Anda harus login terlebih dahulu.');
    }

    const tenantId = request.tenantId || user.tenantId;

    const hasAccess = await this.permissionService.checkAccess(
      user.sub || user.id, // ID user dari token (bisa sub atau id)
      user.role_id,        // ID role dari token
      tenantId,
      resource,
      action,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Akses ditolak: Anda tidak memiliki akses '${action}' pada '${resource}'.`,
      );
    }

    return true;
  }
}
