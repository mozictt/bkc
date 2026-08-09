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
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private tenantContext: TenantContextService,
  ) {}

  async findByUsername(username: string) {
    return this.userRepo.findOne({
      where: { username },
      relations: ['role', 'tenant', 'role.permissions'],
    });
  }

  async findById(id: number) {
    return this.userRepo.findOne({
      where: { id },
      relations: ['role', 'tenant', 'role.permissions'],
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
  ) {
    const user = this.userRepo.create({
      username,
      password: passwordHash,
      role: { id: id_role },
      tenantId,
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
      .select([
        'user.id',
        'user.username',
        'user.is_active',
        'user.createdAt',
        'user.updatedAt',
        'role.id',
        'role.name',
        'role.description',
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
      .select([
        'user.id',
        'user.username',
        'user.is_active',
        'user.createdAt',
        'user.updatedAt',
        'role.id',
        'role.name',
        'role.description',
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
    const tenantId = this.tenantContext.getTenantId();

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

    // Sanitasi data output
    const { password, refreshToken, ...result } = savedUser;
    return result;
  }

  /**
   * Mengubah status keaktifan pengguna (Aktif / Non-Aktif).
   */
  async toggleUserStatus(id: number, isActive: boolean) {
    const tenantId = this.tenantContext.getTenantId();

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
    const tenantId = this.tenantContext.getTenantId();

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

    return {
      success: true,
      message: `User #${id} (${user.username}) berhasil dinonaktifkan / dihapus (soft delete).`,
    };
  }

  /**
   * Mereset password pengguna menjadi default (password123 atau sesuai input).
   */
  async resetUserPassword(id: number, newPassword = 'password123') {
    const tenantId = this.tenantContext.getTenantId();

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
}
