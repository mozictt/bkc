import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Tenant } from '../entities/tenant.entity';
import { Role } from '../role/entities/role.entity';
import { Menu } from '../entities/menu.entity';
import { Permission } from '../entities/permission.entity';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { CloneTenantConfigDto } from './dto/clone-tenant-config.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async registerTenant(dto: RegisterTenantDto) {
    const existing = await this.tenantRepo.findOne({ where: [{ name: dto.name }, { slug: dto.slug }] });
    if (existing) {
      throw new ConflictException('Tenant dengan nama atau slug tersebut sudah ada.');
    }

    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + 14); // Default trial 14 hari

    const newTenant = this.tenantRepo.create({
      name: dto.name,
      slug: dto.slug,
      email: dto.email,
      expiredAt: expiredAt,
      isActive: true,
      isMaster: false,
      settings: {},
    });

    return await this.tenantRepo.save(newTenant);
  }

  async findAll(search?: string, page = 1, limit = 20) {
    const query = this.tenantRepo.createQueryBuilder('tenant');

    if (search) {
      query.where('tenant.name ILIKE :search OR tenant.slug ILIKE :search OR tenant.email ILIKE :search', {
        search: `%${search}%`,
      });
    }

    query.orderBy('tenant.isMaster', 'DESC').addOrderBy('tenant.createdAt', 'DESC');

    const total = await query.getCount();
    const items = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findOne(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant dengan ID ${id} tidak ditemukan.`);
    }
    return tenant;
  }

  async updateSettings(id: string, settings: Record<string, any>) {
    const tenant = await this.findOne(id);
    tenant.settings = { ...(tenant.settings || {}), ...settings };
    return await this.tenantRepo.save(tenant);
  }

  async toggleMaster(id: string) {
    const tenant = await this.findOne(id);
    tenant.isMaster = !tenant.isMaster;
    return await this.tenantRepo.save(tenant);
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.findOne(id);

    if (dto.name !== undefined) {
      // Cek keunikan nama jika berubah
      if (dto.name !== tenant.name) {
        const existing = await this.tenantRepo.findOne({ where: { name: dto.name } });
        if (existing) throw new ConflictException('Tenant dengan nama tersebut sudah ada.');
      }
      tenant.name = dto.name;
    }

    if (dto.email !== undefined) tenant.email = dto.email;
    if (dto.expiredAt !== undefined) tenant.expiredAt = dto.expiredAt ? new Date(dto.expiredAt) : null;
    if (dto.isActive !== undefined) tenant.isActive = dto.isActive;
    if (dto.settings !== undefined) {
      tenant.settings = { ...(tenant.settings || {}), ...dto.settings };
    }

    return await this.tenantRepo.save(tenant);
  }

  /**
   * Menduplikasi konfigurasi Menu, Role (kustom), dan Permission dari Tenant Asal ke Tenant Tujuan
   */
  async cloneTenantConfig(dto: CloneTenantConfigDto) {
    const {
      sourceTenantId,
      targetTenantId,
      includeMenus = true,
      includeRoles = true,
      includePermissions = true,
      excludeSuperAdminRole = true,
    } = dto;

    const targetTenant = await this.tenantRepo.findOne({ where: { id: targetTenantId } });
    if (!targetTenant) {
      throw new NotFoundException(`Target tenant dengan ID ${targetTenantId} tidak ditemukan.`);
    }

    if (targetTenant.isMaster) {
      throw new BadRequestException('Kloning ke Master Tenant tidak diperbolehkan. Master Tenant adalah acuan utama.');
    }

    let effectiveSourceTenantId: string | null = sourceTenantId || null;
    if (sourceTenantId) {
      const sourceTenant = await this.tenantRepo.findOne({ where: { id: sourceTenantId } });
      if (!sourceTenant) {
        throw new NotFoundException(`Source tenant dengan ID ${sourceTenantId} tidak ditemukan.`);
      }
      effectiveSourceTenantId = sourceTenant.id;
    }

    const queryRunner = this.tenantRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const roleMap = new Map<number, Role>();
      let clonedRolesCount = 0;
      let clonedMenusCount = 0;
      let clonedPermissionsCount = 0;

      // 1. Duplikasi Roles
      if (includeRoles) {
        const roleRepo = queryRunner.manager.getRepository(Role);
        const sourceRoles = await roleRepo.find({
          where: effectiveSourceTenantId ? { tenantId: effectiveSourceTenantId } : { tenantId: IsNull() },
        });

        for (const sourceRole of sourceRoles) {
          let existingRole = await roleRepo.findOne({
            where: { tenantId: targetTenantId, name: sourceRole.name },
          });

          if (!existingRole) {
            existingRole = roleRepo.create({
              name: sourceRole.name,
              description: sourceRole.description,
              tenantId: targetTenantId,
            });
            existingRole = await roleRepo.save(existingRole);
            clonedRolesCount++;
          }
          roleMap.set(sourceRole.id, existingRole);
        }
      }

      // 2. Duplikasi Menus
      if (includeMenus) {
        const menuRepo = queryRunner.manager.getRepository(Menu);
        const sourceMenus = await menuRepo.find({
          where: effectiveSourceTenantId ? { tenantId: effectiveSourceTenantId } : { tenantId: IsNull() },
          relations: ['parent'],
        });

        const menuMap = new Map<number, Menu>();

        // Step A: Clone Root Menus (tanpa parent)
        const rootMenus = sourceMenus.filter((m) => !m.parent);
        for (const root of rootMenus) {
          let existingMenu = await menuRepo.findOne({
            where: { tenantId: targetTenantId, name: root.name, parent: IsNull() },
          });

          if (!existingMenu) {
            existingMenu = menuRepo.create({
              name: root.name,
              icon: root.icon,
              url: root.url,
              order_no: root.order_no,
              is_active: root.is_active,
              is_visible: root.is_visible,
              requiredResource: root.requiredResource,
              tenantId: targetTenantId,
            });
            existingMenu = await menuRepo.save(existingMenu);
            clonedMenusCount++;
          }
          menuMap.set(root.id, existingMenu);
        }

        // Step B: Clone Child Menus
        const childMenus = sourceMenus.filter((m) => m.parent);
        for (const child of childMenus) {
          const parentCloned = menuMap.get(child.parent.id);
          let existingChild = await menuRepo.findOne({
            where: { tenantId: targetTenantId, name: child.name, parent: { id: parentCloned?.id } },
          });

          if (!existingChild) {
            existingChild = menuRepo.create({
              name: child.name,
              icon: child.icon,
              url: child.url,
              order_no: child.order_no,
              is_active: child.is_active,
              is_visible: child.is_visible,
              requiredResource: child.requiredResource,
              parent: parentCloned || null as any,
              tenantId: targetTenantId,
            });
            existingChild = await menuRepo.save(existingChild);
            clonedMenusCount++;
          }
          menuMap.set(child.id, existingChild);
        }
      }

      // 3. Duplikasi Permissions
      if (includePermissions && roleMap.size > 0) {
        const permRepo = queryRunner.manager.getRepository(Permission);
        for (const [sourceRoleId, targetRole] of roleMap.entries()) {
          const sourcePerms = await permRepo.find({
            where: { role: { id: sourceRoleId } },
          });

          for (const perm of sourcePerms) {
            let existingPerm = await permRepo.findOne({
              where: {
                role: { id: targetRole.id },
                resource: perm.resource,
                tenantId: targetTenantId,
              },
            });

            if (!existingPerm) {
              existingPerm = permRepo.create({
                role: targetRole,
                resource: perm.resource,
                accessLevel: perm.accessLevel,
                tenantId: targetTenantId,
              });
              await permRepo.save(existingPerm);
              clonedPermissionsCount++;
            }
          }
        }
      }

      // 4. Pembuatan Akun Super Admin Otomatis berbasis nama/slug tenant
      let createdUserSummary: any = null;

      if (dto.createSuperAdminUser !== false) {
        const userRepo = queryRunner.manager.getRepository(User);
        const roleRepo = queryRunner.manager.getRepository(Role);

        // Cari atau buat Role Super Admin untuk target tenant
        let targetSuperAdminRole = await roleRepo.findOne({
          where: { tenantId: targetTenantId, name: 'Super Admin' },
        });

        if (!targetSuperAdminRole) {
          targetSuperAdminRole = roleRepo.create({
            name: 'Super Admin',
            description: 'Akses Penuh Seluruh Sistem',
            tenantId: targetTenantId,
          });
          targetSuperAdminRole = await roleRepo.save(targetSuperAdminRole);
          clonedRolesCount++;
        }

        // Generasi Username Sistem murni berbasis Nama Tenant / Klinik (targetTenant.name)
        const sanitizeUsername = (str: string) => {
          return str
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');
        };

        const tenantName = targetTenant.name || targetTenant.slug;
        const baseUsername = `admin_${sanitizeUsername(tenantName)}`;
        let generatedUsername = baseUsername;
        let counter = 1;

        // Pastikan Username Unik di seluruh sistem
        while (await userRepo.findOne({ where: { username: generatedUsername } })) {
          generatedUsername = `${baseUsername}_${counter}`;
          counter++;
        }

        // Generasi Password (menggunakan customPassword atau bawaan otomatis)
        const plainPassword = dto.customPassword || `Password123!`;
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Cek apakah user untuk tenant ini dengan role Super Admin sudah ada
        let existingUser = await userRepo.findOne({
          where: { tenantId: targetTenantId, username: generatedUsername },
        });

        if (!existingUser) {
          existingUser = userRepo.create({
            username: generatedUsername,
            password: hashedPassword,
            role: targetSuperAdminRole,
            tenantId: targetTenantId,
            is_active: true,
          });
          await userRepo.save(existingUser);
          createdUserSummary = {
            username: generatedUsername,
            password: plainPassword,
            roleName: targetSuperAdminRole.name,
            tenantName: targetTenant.name,
          };
        } else {
          createdUserSummary = {
            username: existingUser.username,
            password: '(Sudah Ada)',
            roleName: targetSuperAdminRole.name,
            tenantName: targetTenant.name,
          };
        }
      }

      await queryRunner.commitTransaction();

      try {
        const keys = await this.redis.keys('menus:*');
        if (keys && keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (err) {
        console.error('[TenantsService] Gagal membersihkan cache menu:', err);
      }

      return {
        success: true,
        message: `Berhasil menduplikasi konfigurasi dari ${sourceTenantId ? 'Tenant Asal' : 'Master Tenant'} ke ${targetTenant.name}.`,
        summary: {
          clonedRolesCount,
          clonedMenusCount,
          clonedPermissionsCount,
          targetTenantName: targetTenant.name,
          createdUser: createdUserSummary,
        },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
