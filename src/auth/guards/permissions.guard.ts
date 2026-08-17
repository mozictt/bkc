// auth/guards/permissions.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRedis } from '@nestjs-modules/ioredis'; // Gunakan decorator ini
import Redis from 'ioredis'; // Import tipe Redis
import { TenantContextService } from '@common/tenant/tenant-context.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRedis() private readonly redis: Redis, // Inject Redis langsung
    private userService: UsersService,
    private tenantContext: TenantContextService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<{
      action: string | string[]; // Diubah agar bisa menerima array
      menu: string;
    }>('permission', context.getHandler());

    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('User session not found');
    }

    // 🛡️ Super Admin dari Master Tenant memiliki akses penuh ke seluruh menu & modul (Cross-Tenant Admin Access)
    const isMaster = this.tenantContext.getIsMaster();
    const roleName = this.tenantContext.getRole() || user?.role;
    if (isMaster && String(roleName).trim().toLowerCase() === 'super admin') {
      return true;
    }

    const cacheKey = `user_menus:${user.userId}`;

    // 1. Cek Cache
    // ioredis mengembalikan string, jadi kita perlu parse JSON
    const cachedData = await this.redis.get(cacheKey);
    let userMenus: any[] | null = cachedData ? JSON.parse(cachedData) : null;
    // console.log(userMenus);

    // 2. Jika Cache Miss
    if (!userMenus) {
      console.log(`[Cache Miss] Mengambil data user ${user.userId} dari DB...`);

      const userData = await this.userService.findUserWithPermissions(
        user.userId,
      );

      if (!userData || !userData.menus) {
        throw new ForbiddenException('User permissions not found');
      }

      userMenus = userData.menus;

      // 3. Simpan ke Redis
      try {
        // 'EX' 36000 berarti expired dalam 36000 detik (10 jam)
        // ioredis menggunakan detik untuk opsi 'EX'
        await this.redis.set(cacheKey, JSON.stringify(userMenus), 'EX', 36000);
        console.log(`[Redis] Data user ${user.userId} berhasil disimpan.`);
      } catch (error) {
        console.error('Redis Set Error:', error);
      }
    } else {
      console.log(`[Cache Hit] Data user ${user.userId} diambil dari Redis.`);
    }
    // 1. Ambil data menu yang cocok dari user
    const menuMatch = userMenus.find((m) => m.name === requiredPermission.menu);
    console.log(userMenus);

    // 2. WAJIB CEK: Jika menu tidak terdaftar sama sekali untuk user ini
    if (!menuMatch) {
      throw new ForbiddenException(
        `Akses ditolak. Anda tidak memiliki akses ke menu ${requiredPermission.menu}`,
      );
    }

    // 3. Normalisasi agar requiredActions SELALU berbentuk Array
    const requiredActions = Array.isArray(requiredPermission.action)
      ? requiredPermission.action
      : [requiredPermission.action];

    // 4. Cek apakah ada salah satu action yang dimiliki oleh user (OR logic)
    const hasValidAction = requiredActions.some(
      (action) => menuMatch.actions && menuMatch.actions.includes(action),
    );

    if (!hasValidAction) {
      throw new ForbiddenException(
        `Akses ditolak untuk menu ${requiredPermission.menu} (Action tidak sesuai)`,
      );
    }

    return true;

    return true;
  }
}
