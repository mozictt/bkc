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
  ) { }

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
    const menus =
      user.role?.menus?.map((menu) => ({
        path: menu.url, // 🔥 ubah jadi object
      })).filter((m) => m.path) || [];

    // ✅ inject default "/"
    const hasRoot = menus.some((m) => m.path === "/");
    if (!hasRoot) {
      menus.unshift({ path: "/" });
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role?.name,
      menus, // optional kalau mau masuk JWT
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn:
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    await this.userService.updateRefreshToken(user.id, refreshToken);

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role?.name,
        id_role: user.role?.id,
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
      role: user.role?.name,
      menus: user.role?.menus?.map((menu) => menu.url).filter(Boolean) || [],
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
    const { username, password, id_role } = registerDto;
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
    );
    return { message: 'Registrasi berhasil', userId: user.id };
  }
}
