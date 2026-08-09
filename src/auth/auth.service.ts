import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { MenuService } from '../menu/menu.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
    private readonly menuService: MenuService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.userService.findByUsername(username); 
    if (user && (await bcrypt.compare(password, user.password))) {
      return user; 
    }

    return null;
  }

  async login(user: any) {
    const menus = user.role?.id 
      ? await this.menuService.getAllMenusByRoleId(user.role.id, user.tenantId) 
      : [];

    const payload = {
      sub: user.id,
      username: user.username,
      tenantId: user.tenantId, 
      role_id: user.role?.id,
      slug: user.tenant?.slug,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn:
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    await this.userService.updateRefreshToken(user.id, refreshToken);
    // console.log(user.tenantId);
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role?.name,
        id_role: user.role?.id,
        tenantId: user.tenantId, // 👈 Return tenantId ke client
        tenant: user.tenant, // 👈 Return tenantId ke client
        menus,
      },
      accessToken,
      refreshToken,
    };
  }

  // async refresh(userId: number, token: string) {
  //   const user = await this.userService.findById(userId);
  //   // console.log('TOKEN DARI DB     :', user.refreshToken);
  //   if (!user || user.refreshToken !== token) {
  //     throw new UnauthorizedException('Refresh token tidak valid atau sudah expired');
  //   }

  //   const payload = { username: user.username, sub: user.id };
  //   const accessToken = this.jwtService.sign(payload, {
  //     expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1h',
  //   });
  //   const refreshToken = this.jwtService.sign(payload, {
  //     expiresIn:
  //       this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
  //   });

  //   await this.userService.updateRefreshToken(user.id, refreshToken);
  //   return { accessToken, refreshToken };
  // }
  async refresh(userId: number, token: string) {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    // 🔥 cek expired / valid JWT
    try {
      this.jwtService.verify(token);
    } catch (err) {
      throw new UnauthorizedException('Refresh token sudah expired');
    }

    // 🔥 cek token cocok dengan DB (rotation)
    if (user.refreshToken !== token) {
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      tenantId: user.tenantId, // 👈 Pastikan ada saat refresh
      role: user.role?.name,
      slug: user.tenant.slug,
      // menus: this.mapMenus(user.role?.permissions),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn:
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    await this.userService.updateRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }
  async register(registerDto: RegisterDto) {
    //  console.log('registerDto:', registerDto); // tampilkan isi registerDto
    // return;
    const { username, password, id_role, tenantId } = registerDto;
    // Cek jika user sudah ada
    const existingUser = await this.userService.findByUsername(username);
    if (existingUser) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Username sudah digunakan',
        error: 'Conflict',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    // Simpan user baru
    console.log(username);
    const user = await this.userService.create(
      username,
      hashedPassword,
      id_role,
      tenantId, // 👈 Kirim tenantId ke service user
    );
    return { message: 'Registrasi berhasil', userId: user.id };
  }

  async logout(userId: number, token: string) {
    // 1. Cabut hak refresh token dengan mengatur nilainya menjadi null
    await this.userService.updateRefreshToken(userId, null);

    // 2. Hapus cache permission user di Redis agar bersih dan aman
    await this.redis.del(`user_menus:${userId}`);

    // 3. Masukkan access token ke Blacklist Redis
    try {
      const decoded: any = this.jwtService.decode(token);
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          // Masukkan ke blacklist, akan auto-expire sesuai sisa waktu token
          await this.redis.set(`blacklist_token:${token}`, 'true', 'EX', expiresIn);
        }
      }
    } catch (error) {
      // Abaikan jika token gagal di-decode
    }

    return {
      success: true,
      message: 'Logout berhasil. Sesi, token, dan cache telah dihapus.',
    };
  }

  // private mapMenus(permissions: any[]): any[] {
  //   const flatMenus =
  //     permissions
  //       ?.map((p: any) => {
  //         // Logika default action: jika null/undefined/kosong, isi dengan ["view"]
  //         const sanitizedActions =
  //           p.actions && p.actions.length > 0 ? p.actions : ['view'];

  //         return {
  //           id: p.menu?.id,
  //           parentId: p.menu?.parent?.id || null,
  //           name: p.menu?.name,
  //           path: p.menu?.url,
  //           icon: p.menu?.icon,
  //           order_no: p.menu?.order_no || 0,
  //           actions: sanitizedActions, // Gunakan hasil sanitasi
  //         };
  //       })
  //       .filter((m) => m.id) || [];

  //   const menuMap = new Map();
  //   const tree: any[] = [];

  //   // Buat map untuk akses cepat
  //   flatMenus.forEach((item) => {
  //     menuMap.set(item.id, { ...item, children: [] });
  //   });

  //   // Susun hirarki
  //   flatMenus.forEach((item) => {
  //     const node = menuMap.get(item.id);
  //     if (item.parentId && menuMap.has(item.parentId)) {
  //       menuMap.get(item.parentId).children.push(node);
  //     } else {
  //       tree.push(node);
  //     }
  //   });

  //   // Urutkan berdasarkan order_no
  //   const finalTree = tree.sort((a, b) => a.order_no - b.order_no);

  //   // Pastikan menu Home ada di paling atas
  //   if (!finalTree.some((m) => m.path === '/')) {
  //     finalTree.unshift({
  //       name: 'Home',
  //       path: '/',
  //       icon: 'home',
  //       actions: ['view'], // Sebaiknya Home juga diberi 'view' agar konsisten
  //       children: [],
  //     });
  //   }

  //   return finalTree;
  // }
}
