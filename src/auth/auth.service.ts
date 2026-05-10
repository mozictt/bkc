// src/auth/auth.service.ts
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
import { exit } from 'process';

@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // async validateUser(username: string, password: string) {
  //   const user = await this.userService.findByUsername(username);
  //   if (user && (await bcrypt.compare(password, user.password))) {
  //     return user;
  //   }
  //   return null;
  // }
  async validateUser(username: string, password: string) {
    const user = await this.userService.findByUsername(username);
    if (user && (await bcrypt.compare(password, user.password))) {
      return user; // sudah termasuk role & menus
    }

    return null;
  }

  // async login(user: any) {
  //   const payload = { username: user.username, sub: user.id };
  //   const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
  //   const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

  //   await this.userService.updateRefreshToken(user.id, refreshToken);

  //   return { accessToken, refreshToken };
  // }
  async login(user: any) {
    const menus = this.mapMenus(user.role?.permissions);

    const payload = {
      sub: user.id,
      username: user.username,
      tenantId: user.tenantId, // 👈 Masukkan tenantId ke JWT 
      role_id: user.role?.id,
      // menus, // optional kalau mau masuk JWT
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

  private mapMenus(permissions: any[]): any[] {
    const flatMenus =
      permissions
        ?.map((p: any) => {
          // Logika default action: jika null/undefined/kosong, isi dengan ["view"]
          const sanitizedActions =
            p.actions && p.actions.length > 0 ? p.actions : ['view'];

          return {
            id: p.menu?.id,
            parentId: p.menu?.parent?.id || null,
            name: p.menu?.name,
            path: p.menu?.url,
            icon: p.menu?.icon,
            order_no: p.menu?.order_no || 0,
            actions: sanitizedActions, // Gunakan hasil sanitasi
          };
        })
        .filter((m) => m.id) || [];

    const menuMap = new Map();
    const tree: any[] = [];

    // Buat map untuk akses cepat
    flatMenus.forEach((item) => {
      menuMap.set(item.id, { ...item, children: [] });
    });

    // Susun hirarki
    flatMenus.forEach((item) => {
      const node = menuMap.get(item.id);
      if (item.parentId && menuMap.has(item.parentId)) {
        menuMap.get(item.parentId).children.push(node);
      } else {
        tree.push(node);
      }
    });

    // Urutkan berdasarkan order_no
    const finalTree = tree.sort((a, b) => a.order_no - b.order_no);

    // Pastikan menu Home ada di paling atas
    if (!finalTree.some((m) => m.path === '/')) {
      finalTree.unshift({
        name: 'Home',
        path: '/',
        icon: 'home',
        actions: ['view'], // Sebaiknya Home juga diberi 'view' agar konsisten
        children: [],
      });
    }

    return finalTree;
  }
}
