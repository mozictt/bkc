// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Pegawai } from '../entities/pegawai.entity';
import { Tenant } from '../entities/tenant.entity';
import { Role } from '../role/entities/role.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Pegawai)
    private pegawaiRepo: Repository<Pegawai>,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private tenantContext: TenantContextService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async findByUsername(username: string) {
    return this.userRepo.findOne({
      where: { username },
      relations: ['role', 'tenant', 'role.permissions', 'pegawai'],
    });
  }

  async findById(id: number) {
    return this.userRepo.findOne({
      where: { id },
      relations: ['role', 'tenant', 'role.permissions', 'pegawai'],
    });
  }

  async findUserWithPermissions(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions'],
    });
    if (!user) return null;

    return {
      ...user,
      menus: [],
    };
  }

  async updateRefreshToken(userId: number, token: string | null) {
    await this.userRepo.update(userId, { refreshToken: token });
  }

  async create(
    username: string,
    passwordHash: string,
    id_role: number,
    tenantId: string,
    pegawaiId: number,
  ) {
    // 🔍 1. Target Tenant ID Resolution: Prioritaskan tenantId yang dikirimkan (UUID/slug)
    let targetTenantId: string | null = null;

    if (tenantId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
      if (isUuid) {
        targetTenantId = tenantId;
      } else {
        const tenantObj = await this.tenantRepo.findOne({ where: { slug: tenantId } });
        if (tenantObj) {
          targetTenantId = tenantObj.id;
        }
      }
    }

    if (!targetTenantId) {
      targetTenantId = this.tenantContext.getTenantId();
    }

    // 🔍 2. Resolusi Role ID jika role ID berasal dari Master Tenant atau Tenant lain
    let targetRoleId = id_role;
    if (targetTenantId) {
      const currentRole = await this.roleRepo
        .createQueryBuilder('role')
        .where('role.id = :id_role', { id_role })
        .getOne();

      if (currentRole && currentRole.tenantId !== targetTenantId) {
        const matchingTenantRole = await this.roleRepo
          .createQueryBuilder('role')
          .where('LOWER(role.name) = LOWER(:name)', { name: currentRole.name })
          .andWhere('role.tenantId = :targetTenantId', { targetTenantId })
          .getOne();

        if (matchingTenantRole) {
          targetRoleId = matchingTenantRole.id;
        }
      }
    }

    // 3. Validasi apakah Pegawai ada di target tenant yang sama
    const pegawai = await this.pegawaiRepo.findOne({
      where: { id: pegawaiId, tenantId: targetTenantId ? targetTenantId : undefined },
    });
    if (!pegawai) {
      throw new NotFoundException(`Pegawai dengan ID #${pegawaiId} tidak ditemukan.`);
    }

    // 4. Validasi apakah Pegawai sudah dikaitkan dengan akun user lain
    const existingUser = await this.userRepo.findOne({
      where: { pegawaiId },
    });
    if (existingUser) {
      throw new ConflictException(`Pegawai "${pegawai.name}" sudah memiliki akun user.`);
    }

    const user = this.userRepo.create({
      username,
      password: passwordHash,
      role: { id: targetRoleId },
      tenantId: targetTenantId,
      pegawaiId,
      is_active: true,
    });
    return this.userRepo.save(user);
  }

  /**
   * Mendapatkan SELURUH daftar pengguna tanpa pagination (untuk Select2 / dropdown / list lengkap).
   */
  async getAllUsers(search = '', isActive?: boolean) {
    const tenantId = this.tenantContext.getTenantId();

    const queryBuilder = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.pegawai', 'pegawai')
      .select([
        'user.id',
        'user.username',
        'user.is_active',
        'user.createdAt',
        'user.updatedAt',
        'role.id',
        'role.name',
        'role.description',
        'pegawai.id',
        'pegawai.nip',
        'pegawai.name',
        'pegawai.email',
      ]);

    if (tenantId) {
      queryBuilder.andWhere('user.tenantId = :tenantId', { tenantId });
    }

    if (search) {
      queryBuilder.andWhere('LOWER(user.username) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.is_active = :isActive', { isActive });
    }

    return await queryBuilder.orderBy('user.username', 'ASC').getMany();
  }

  /**
   * Mendapatkan daftar pengguna dengan Pagination, Search (Username & Role), dan Filter.
   */
  async findAllUsers(
    page = 1,
    limit = 10,
    search = '',
    isActive?: boolean,
    roleId?: number,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const tenantId = this.tenantContext.getTenantId();

    const queryBuilder = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.pegawai', 'pegawai')
      .select([
        'user.id',
        'user.username',
        'user.is_active',
        'user.createdAt',
        'user.updatedAt',
        'role.id',
        'role.name',
        'role.description',
        'pegawai.id',
        'pegawai.nip',
        'pegawai.name',
        'pegawai.email',
      ]);

    if (tenantId) {
      queryBuilder.andWhere('user.tenantId = :tenantId', { tenantId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(user.username) LIKE :search OR LOWER(role.name) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.is_active = :isActive', { isActive });
    }

    if (roleId) {
      queryBuilder.andWhere('role.id = :roleId', { roleId });
    }

    const [data, total] = await queryBuilder
      .orderBy('user.id', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      items: data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
        currentPage: safePage,
      },
    };
  }

  /**
   * Memperbarui data pengguna (Username, Role, Password, Status).
   */
  async updateUser(id: number, dto: UpdateUserDto) {
    const isMaster = this.tenantContext.getIsMaster();
    const tenantId = isMaster ? undefined : this.tenantContext.getTenantId();

    const user = await this.userRepo.findOne({
      where: {
        id,
        tenantId: tenantId ? tenantId : undefined,
      },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID #${id} tidak ditemukan.`);
    }

    // Cek jika username diubah dan sudah dipakai user lain
    if (dto.username && dto.username !== user.username) {
      const existingUser = await this.userRepo.findOne({
        where: {
          username: dto.username,
          tenantId: tenantId ? tenantId : undefined,
        },
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(`Username "${dto.username}" sudah digunakan.`);
      }
      user.username = dto.username;
    }

    // Hash password baru jika dikirim
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
    }

    if (dto.role_id) {
      user.role = { id: dto.role_id } as any;
    }

    if (dto.is_active !== undefined) {
      user.is_active = dto.is_active;
    }

    const savedUser = await this.userRepo.save(user);
    await this.deleteProfileCache(id);

    // Sanitasi data output
    const { password, refreshToken, ...result } = savedUser;
    return result;
  }

  /**
   * Mengubah status keaktifan pengguna (Aktif / Non-Aktif).
   */
  async toggleUserStatus(id: number, isActive: boolean) {
    const isMaster = this.tenantContext.getIsMaster();
    const tenantId = isMaster ? undefined : this.tenantContext.getTenantId();

    const user = await this.userRepo.findOne({
      where: {
        id,
        tenantId: tenantId ? tenantId : undefined,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID #${id} tidak ditemukan.`);
    }

    user.is_active = isActive;
    await this.userRepo.save(user);
    await this.deleteProfileCache(id);

    return {
      success: true,
      message: `Status pengguna #${id} (${user.username}) berhasil diubah menjadi ${
        isActive ? 'Aktif' : 'Non-Aktif'
      }.`,
      is_active: isActive,
    };
  }

  /**
   * Menghapus (Soft Delete) pengguna.
   */
  async removeUser(id: number) {
    const isMaster = this.tenantContext.getIsMaster();
    const tenantId = isMaster ? undefined : this.tenantContext.getTenantId();

    const user = await this.userRepo.findOne({
      where: {
        id,
        tenantId: tenantId ? tenantId : undefined,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID #${id} tidak ditemukan.`);
    }

    await this.userRepo.softRemove(user);
    await this.deleteProfileCache(id);

    return {
      success: true,
      message: `User #${id} (${user.username}) berhasil dinonaktifkan / dihapus (soft delete).`,
    };
  }

  /**
   * Mereset password pengguna menjadi default (password123 atau sesuai input).
   */
  async resetUserPassword(id: number, newPassword = 'password123') {
    const isMaster = this.tenantContext.getIsMaster();
    const tenantId = isMaster ? undefined : this.tenantContext.getTenantId();

    const user = await this.userRepo.findOne({
      where: {
        id,
        tenantId: tenantId ? tenantId : undefined,
      },
    });

    if (!user) {
      throw new NotFoundException(`User dengan ID #${id} tidak ditemukan.`);
    }

    const targetPassword = newPassword && newPassword.trim() ? newPassword.trim() : 'password123';
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(targetPassword, salt);

    user.password = hashedPassword;
    user.refreshToken = null; // Cabut sesi aktif user

    await this.userRepo.save(user);
    await this.deleteProfileCache(id);

    return {
      success: true,
      message: `Password pengguna #${id} (${user.username}) berhasil di-reset menjadi default (${targetPassword}).`,
      default_password: targetPassword,
    };
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

  async deleteProfileCache(userId: number) {
    const cacheKey = `user_profile:${userId}`;
    await this.redis.del(cacheKey);
  }

  async getProfile(userId: number) {
    const cacheKey = `user_profile:${userId}`;
    const cachedProfile = await this.redis.get(cacheKey);
    if (cachedProfile) {
      return JSON.parse(cachedProfile);
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role', 'tenant', 'pegawai'],
    });

    if (!user) {
      throw new NotFoundException(`Pengguna dengan ID #${userId} tidak ditemukan.`);
    }

    // Hapus data sensitif
    delete user.password;
    delete user.refreshToken;

    await this.redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);

    return user;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['pegawai'],
    });

    if (!user || !user.pegawai) {
      throw new NotFoundException('Data pegawai untuk pengguna ini tidak ditemukan.');
    }

    // Update data pegawai
    Object.assign(user.pegawai, dto);
    const updatedPegawai = await this.pegawaiRepo.save(user.pegawai);
    await this.deleteProfileCache(userId);

    return updatedPegawai;
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    // Verifikasi password lama
    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Kata sandi lama salah.');
    }

    // Hash dan simpan password baru
    const salt = await bcrypt.genSalt();
    user.password = await bcrypt.hash(dto.newPassword, salt);
    user.refreshToken = null; // Reset refresh token untuk force logout
    await this.userRepo.save(user);
    await this.deleteProfileCache(userId);

    return {
      success: true,
      message: 'Kata sandi berhasil diubah. Silakan login kembali.',
    };
  }

  async updateAvatar(userId: number, relativePath: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['pegawai'],
    });

    if (!user || !user.pegawai) {
      throw new NotFoundException('Data pegawai tidak ditemukan.');
    }

    // Hapus berkas avatar lama dari disk jika ada
    if (user.pegawai.avatar) {
      const oldPath = path.join(process.cwd(), user.pegawai.avatar);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Gagal menghapus foto profil lama dari server disk:', e);
        }
      }
    }

    user.pegawai.avatar = relativePath;
    await this.pegawaiRepo.save(user.pegawai);
    await this.deleteProfileCache(userId);

    return {
      success: true,
      message: 'Foto profil berhasil diunggah.',
      avatarUrl: relativePath,
    };
  }
}
