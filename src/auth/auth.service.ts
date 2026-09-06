import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { sanitizePayload } from '../activity-logs/utils/sanitize-payload.util';

@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.userService.findByUsername(username); 
    if (user && (await bcrypt.compare(password, user.password))) {
      // Cek kedaluwarsa tenant
      if (user.tenant && user.tenant.expiredAt) {
        const now = new Date();
        const expiredDate = new Date(user.tenant.expiredAt);
        if (now > expiredDate) {
          throw new UnauthorizedException('Akses ditolak: Masa berlangganan klinik/tenant Anda sudah habis.');
        }
      }
      return user; 
    }

    return null;
  }

  async login(user: any, req?: any) {
    const payload = {
      sub: user.id,
      username: user.username,
      tenantId: user.tenantId, 
      role_id: user.role?.id,
      role: user.role?.name,
      slug: user.tenant?.slug,
      tenantExpiredAt: user.tenant?.expiredAt,
      name_pegawai: user.pegawai?.name || null,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn:
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    await this.userService.updateRefreshToken(user.id, refreshToken);
    
    // Log aktivitas LOGIN secara dinamis dari HTTP request
    try {
      const path = req?.originalUrl || req?.url || '/auth/login';
      const method = req?.method || 'POST';
      const rawIp = req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || req?.ip;
      const ipAddress = Array.isArray(rawIp) ? rawIp[0] : rawIp;
      const userAgent = req?.headers?.['user-agent'];

      const bodyToLog = req?.body ? sanitizePayload(req.body) : { username: user.username, password: '***SENSITIVE***' };

      await this.activityLogsService.createLog({
        tenantId: user.tenantId || null,
        userId: user.id,
        username: user.username,
        action: 'LOGIN',
        module: 'AUTH',
        description: `User ${user.username} berhasil login ke dalam sistem.`,
        method: method,
        path: path,
        ipAddress: ipAddress ? String(ipAddress) : null,
        userAgent: userAgent ? String(userAgent) : null,
        body: bodyToLog,
      });
    } catch (e) {
      console.error('Gagal mencatat log login:', e);
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role?.name,
        id_role: user.role?.id,
        tenantId: user.tenantId,
        tenant: user.tenant,
        isMaster: user.tenant?.isMaster || false,
        name_pegawai: user.pegawai?.name || null,
        pegawai: user.pegawai ? {
          id: user.pegawai.id,
          nip: user.pegawai.nip,
          name: user.pegawai.name,
          email: user.pegawai.email,
        } : null,
      },
      accessToken,
      refreshToken,
    };
  }

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
      tenantExpiredAt: user.tenant?.expiredAt,
      name_pegawai: user.pegawai?.name || null,
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
    const { username, password, id_role, tenantId, pegawaiId } = registerDto;
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
      tenantId,
      pegawaiId, // 👈 Teruskan pegawaiId ke service user
    );
    return { message: 'Registrasi berhasil', userId: user.id };
  }

  async logout(userId: number, token: string, req?: any) {
    // 1. Cabut hak refresh token dengan mengatur nilainya menjadi null
    await this.userService.updateRefreshToken(userId, null);

    // 2. Hapus semua data Redis yang terasosiasi dengan id_user (*:<userId>)
    try {
      const userKeys = await this.redis.keys(`*:${userId}`);
      if (userKeys && userKeys.length > 0) {
        await this.redis.del(...userKeys);
      }
    } catch (err) {
      console.error(`Gagal menghapus cache Redis untuk userId ${userId}:`, err);
    }

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

      // Log aktivitas LOGOUT secara dinamis dari HTTP request
      const path = req?.originalUrl || req?.url || '/auth/logout';
      const method = req?.method || 'POST';
      const rawIp = req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || req?.ip;
      const ipAddress = Array.isArray(rawIp) ? rawIp[0] : rawIp;
      const userAgent = req?.headers?.['user-agent'];

      await this.activityLogsService.createLog({
        tenantId: decoded?.tenantId || null,
        userId: userId,
        username: decoded?.username || null,
        action: 'LOGOUT',
        module: 'AUTH',
        description: `User ${decoded?.username || userId} telah keluar (logout) dari sistem.`,
        method: method,
        path: path,
        ipAddress: ipAddress ? String(ipAddress) : null,
        userAgent: userAgent ? String(userAgent) : null,
      });
    } catch (error) {
      // Abaikan jika token gagal di-decode atau log gagal
    }

    return {
      success: true,
      message: 'Logout berhasil. Sesi, token, dan cache telah dihapus.',
    };
  }

  /**
   * Switch Login (Impersonation) dari Master Super Admin ke User Target Tenant Anak
   */
  async switchUser(masterUserPayload: any, targetUserId: number | string, req?: any) {
    const targetUser = await this.userService.findById(+targetUserId);
    if (!targetUser) {
      throw new NotFoundException(`User target dengan ID ${targetUserId} tidak ditemukan.`);
    }

    if (!targetUser.is_active) {
      throw new BadRequestException(`User ${targetUser.username} sedang dalam status non-aktif.`);
    }

    // Cek kedaluwarsa tenant anak
    if (targetUser.tenant && targetUser.tenant.expiredAt) {
      const now = new Date();
      const expiredDate = new Date(targetUser.tenant.expiredAt);
      if (now > expiredDate) {
        throw new UnauthorizedException('Masa berlangganan klinik/tenant tujuan telah kadaluarsa.');
      }
    }

    const impersonatorInfo = {
      id: masterUserPayload.sub || masterUserPayload.userId || masterUserPayload.id,
      username: masterUserPayload.username,
      tenantId: masterUserPayload.tenantId,
      role: masterUserPayload.role,
    };

    const payload = {
      sub: targetUser.id,
      username: targetUser.username,
      tenantId: targetUser.tenantId,
      role_id: targetUser.role?.id,
      role: targetUser.role?.name,
      slug: targetUser.tenant?.slug,
      tenantExpiredAt: targetUser.tenant?.expiredAt,
      name_pegawai: targetUser.pegawai?.name || null,
      isImpersonated: true,
      impersonator: impersonatorInfo,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '2h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    // ⚡ Langsung switch login tanpa meng-update data user tujuan di DB

    // Catat Audit Trail Log
    try {
      const rawIp = req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || req?.ip;
      const ipAddress = Array.isArray(rawIp) ? rawIp[0] : rawIp;
      const userAgent = req?.headers?.['user-agent'];

      await this.activityLogsService.createLog({
        tenantId: targetUser.tenantId || null,
        userId: impersonatorInfo.id,
        username: impersonatorInfo.username,
        action: 'IMPERSONATE_START',
        module: 'AUTH',
        description: `Super Admin ${impersonatorInfo.username} switch login ke akun user ${targetUser.username} (Tenant: ${targetUser.tenant?.name || targetUser.tenantId}).`,
        method: req?.method || 'POST',
        path: req?.originalUrl || '/auth/switch-user',
        ipAddress: ipAddress ? String(ipAddress) : null,
        userAgent: userAgent ? String(userAgent) : null,
      });
    } catch (err) {
      console.error('Gagal mencatat log activity impersonation:', err);
    }

    return {
      success: true,
      message: `Berhasil switch login ke user ${targetUser.username}`,
      accessToken,
      refreshToken,
      isImpersonated: true,
      impersonator: impersonatorInfo,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        role: targetUser.role?.name,
        id_role: targetUser.role?.id,
        tenantId: targetUser.tenantId,
        tenantName: targetUser.tenant?.name || null,
        tenantSlug: targetUser.tenant?.slug || null,
        pegawai: targetUser.pegawai || null,
      },
    };
  }

  /**
   * Kembali dari mode Switch User (Impersonation) ke Akun Master Tenant Utama
   */
  async switchBack(currentUserPayload: any, req?: any) {
    if (!currentUserPayload?.isImpersonated || !currentUserPayload?.impersonator) {
      throw new BadRequestException('Anda tidak sedang berada dalam mode Switch User.');
    }

    const masterUserId = currentUserPayload.impersonator.id;
    const masterUser = await this.userService.findById(+masterUserId);

    if (!masterUser || !masterUser.is_active) {
      throw new BadRequestException('Akun Master Tenant tidak ditemukan atau dalam status non-aktif.');
    }

    // Terbitkan kembali sesi Master Tenant
    const masterLoginResult = await this.login(masterUser, req);

    // Catat Audit Trail Log
    try {
      const rawIp = req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || req?.ip;
      const ipAddress = Array.isArray(rawIp) ? rawIp[0] : rawIp;
      const userAgent = req?.headers?.['user-agent'];

      await this.activityLogsService.createLog({
        tenantId: masterUser.tenantId || null,
        userId: masterUser.id,
        username: masterUser.username,
        action: 'IMPERSONATE_END',
        module: 'AUTH',
        description: `Super Admin ${masterUser.username} menghentikan mode switch user dan kembali ke Master Tenant.`,
        method: req?.method || 'POST',
        path: req?.originalUrl || '/auth/switch-back',
        ipAddress: ipAddress ? String(ipAddress) : null,
        userAgent: userAgent ? String(userAgent) : null,
      });
    } catch (err) {
      console.error('Gagal mencatat log activity switch-back:', err);
    }

    return {
      success: true,
      message: 'Berhasil kembali ke akun Master Tenant utama.',
      ...masterLoginResult,
    };
  }
}
