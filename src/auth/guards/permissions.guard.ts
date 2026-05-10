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
import { UsersService } from '@src/users/users.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRedis() private readonly redis: Redis, // Inject Redis langsung
    private userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<{
      action: string;
      menu: string;
    }>('permission', context.getHandler());

    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('User session not found');
    }

    const cacheKey = `user_menus:${user.userId}`;

    // 1. Cek Cache
    // ioredis mengembalikan string, jadi kita perlu parse JSON
    const cachedData = await this.redis.get(cacheKey);
    let userMenus: any[] | null = cachedData ? JSON.parse(cachedData) : null;

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
        await this.redis.set(
          cacheKey, 
          JSON.stringify(userMenus), 
          'EX', 
          36000
        );
        
        console.log(`[Redis] Data user ${user.userId} berhasil disimpan.`);
      } catch (error) {
        console.error('Redis Set Error:', error);
      }
    } else {
      console.log(`[Cache Hit] Data user ${user.userId} diambil dari Redis.`);
    }

    // 4. Validasi logic
    const menuMatch = userMenus.find((m) => m.name === requiredPermission.menu);
    if (!menuMatch || !menuMatch.actions.includes(requiredPermission.action)) {
      throw new ForbiddenException(
        `Akses ditolak untuk menu ${requiredPermission.menu}`,
      );
    }

    return true;
  }
}