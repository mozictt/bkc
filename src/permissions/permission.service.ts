import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '@entities/permission.entity';
import { Menu } from '@entities/menu.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { AccessLevel, AccessLevelMapping, PrimitiveAction } from './constants/access-level.constant';
import { CopyRolePermissionsDto, CopyPermissionMode } from './dto/copy-permission.dto';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(Menu)
    private readonly menuRepo: Repository<Menu>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async checkAccess(
    userId: number,
    roleId: number,
    tenantId: string,
    resource: string,
    action: PrimitiveAction,
  ): Promise<boolean> {
    
    // 1. Check User specific permission first (Override)
    if (userId) {
      const userPermission = await this.permissionRepo.findOne({
        where: { user: { id: userId }, resource, tenantId: tenantId ? tenantId : undefined },
      });

      if (userPermission) {
        const allowedActions = AccessLevelMapping[userPermission.accessLevel] || [];
        if (allowedActions.includes(action) || allowedActions.includes('manage')) {
          return true;
        }
      }
    }

    // 2. Check Role specific permission (Fallback)
    if (roleId) {
      const rolePermission = await this.permissionRepo.findOne({
        where: { role: { id: roleId }, resource, tenantId: tenantId ? tenantId : undefined },
      });

      if (rolePermission) {
        const allowedActions = AccessLevelMapping[rolePermission.accessLevel] || [];
        if (allowedActions.includes(action) || allowedActions.includes('manage')) {
          return true;
        }
      }
    }

    // Default deny
    return false;
  }

  /**
   * Mengambil seluruh resource permissions yang di-grouping berdasarkan Induk Menu (Module).
   * Mencegah masalah N+1 Query dengan melakukan bulk query sekaligus.
   */
  async getGroupedResourcePermissions(roleId?: number): Promise<any[]> {
    const tenantId = this.tenantContext.getTenantId();

    // 1. Bulk fetch all active menus with their parent relations in 1 single query
    const menus = await this.menuRepo.find({
      where: {
        is_active: true,
        tenantId: tenantId ? tenantId : undefined,
      },
      relations: ['parent'],
      order: {
        order_no: 'ASC',
      },
    });

    // 2. Bulk fetch all permissions for specified roleId in 1 single query
    let permissions: Permission[] = [];
    if (roleId) {
      permissions = await this.permissionRepo.find({
        where: {
          role: { id: roleId },
          tenantId: tenantId ? tenantId : undefined,
        },
      });
    }

    const permMap = new Map<string, AccessLevel>();
    permissions.forEach((p) => {
      if (p.resource) {
        permMap.set(p.resource, p.accessLevel);
      }
    });

    // 3. Grouping in-memory by Parent Menu / Category
    const groupMap = new Map<string, any>();

    menus.forEach((menu) => {
      if (!menu.requiredResource) return; // Hanya menu yang memiliki Resource Key

      const groupName = menu.parent ? menu.parent.name : (menu.name || 'Umum');
      const groupIcon = menu.parent ? menu.parent.icon : (menu.icon || 'folder');

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, {
          group: groupName,
          icon: groupIcon,
          resources: [],
        });
      }

      const accessLevel = permMap.get(menu.requiredResource) || null;

      groupMap.get(groupName).resources.push({
        id: menu.id,
        name: menu.name,
        resource: menu.requiredResource,
        icon: menu.icon,
        url: menu.url,
        accessLevel: accessLevel,
        availableAccessLevels: Object.values(AccessLevel),
      });
    });

    return Array.from(groupMap.values());
  }

  /**
   * Mengambil daftar seluruh nama Resource Key unik murni dari tabel permissions.
   */
  async getAvailableResources(format?: string): Promise<any[]> {
    const tenantId = this.tenantContext.getTenantId();

    const permQb = this.permissionRepo
      .createQueryBuilder('permission')
      .select('DISTINCT permission.resource', 'resource')
      .where('permission.resource IS NOT NULL')
      .andWhere("permission.resource != ''");

    if (tenantId) {
      permQb.andWhere('permission.tenantId = :tenantId', { tenantId });
    }

    const permResults = await permQb.getRawMany();
    const rawResources = permResults
      .map((r) => r.resource)
      .filter(Boolean);

    if (format === 'array' || format === 'simple') {
      return rawResources;
    }

    // Default: Return format { label, value, id, name } yang siap dipakai di Select2 / Vue Select
    return rawResources.map((res) => ({
      label: res,
      value: res,
      id: res,
      name: res,
    }));
  }

  /**
   * Update hak akses (Permission) berdasarkan ID Permission.
   */
  async updatePermissionById(
    id: number,
    dto: { resource?: string; accessLevel: AccessLevel },
  ): Promise<Permission> {
    const tenantId = this.tenantContext.getTenantId();

    const perm = await this.permissionRepo.findOne({
      where: {
        id,
        tenantId: tenantId ? tenantId : undefined,
      },
    });

    if (!perm) {
      throw new NotFoundException(`Permission dengan ID #${id} tidak ditemukan.`);
    }

    if (dto.resource) {
      perm.resource = dto.resource;
    }
    if (dto.accessLevel) {
      perm.accessLevel = dto.accessLevel;
    }

    return await this.permissionRepo.save(perm);
  }

  /**
   * Bulk Sync / Upsert seluruh permissions untuk sebuah Role.
   */
  async syncRolePermissions(dto: {
    role_id: number;
    permissions: Array<{ resource: string; accessLevel: AccessLevel }>;
  }): Promise<{ message: string; updatedCount: number }> {
    const tenantId = this.tenantContext.getTenantId();
    const { role_id, permissions } = dto;

    const existingPerms = await this.permissionRepo.find({
      where: {
        role: { id: role_id },
        tenantId: tenantId ? tenantId : undefined,
      },
    });

    const existingMap = new Map<string, Permission>();
    existingPerms.forEach((p) => existingMap.set(p.resource, p));

    const toSave: Permission[] = [];

    for (const item of permissions) {
      if (existingMap.has(item.resource)) {
        const perm = existingMap.get(item.resource)!;
        perm.accessLevel = item.accessLevel;
        toSave.push(perm);
      } else {
        const perm = this.permissionRepo.create({
          role: { id: role_id },
          resource: item.resource,
          accessLevel: item.accessLevel,
          tenantId: tenantId ? tenantId : undefined,
        });
        toSave.push(perm);
      }
    }

    if (toSave.length > 0) {
      await this.permissionRepo.save(toSave);
    }

    return {
      message: `Berhasil memperbarui ${toSave.length} permissions untuk Role ID #${role_id}.`,
      updatedCount: toSave.length,
    };
  }

  /**
   * Menghapus hak akses (Permission) berdasarkan ID (Soft Delete).
   */
  async deletePermissionById(id: number): Promise<{ success: boolean; message: string }> {
    const tenantId = this.tenantContext.getTenantId();

    const perm = await this.permissionRepo.findOne({
      where: {
        id,
        tenantId: tenantId ? tenantId : undefined,
      },
    });

    if (!perm) {
      throw new NotFoundException(`Permission dengan ID #${id} tidak ditemukan.`);
    }

    // Soft Delete: Mengisi kolom deleted_at dengan timestamp saat ini
    await this.permissionRepo.softRemove(perm);
    return {
      success: true,
      message: `Permission dengan ID #${id} berhasil dihapus (soft delete).`,
    };
  }

  /**
   * Menghapus hak akses (Permission) berdasarkan roleId dan nama resource (Soft Delete).
   */
  async deletePermissionByRoleAndResource(
    roleId: number,
    resource: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = this.tenantContext.getTenantId();

    const perm = await this.permissionRepo.findOne({
      where: {
        role: { id: roleId },
        resource,
        tenantId: tenantId ? tenantId : undefined,
      },
    });

    if (!perm) {
      throw new NotFoundException(
        `Permission untuk resource "${resource}" pada Role ID #${roleId} tidak ditemukan.`,
      );
    }

    // Soft Delete: Mengisi kolom deleted_at dengan timestamp saat ini
    await this.permissionRepo.softRemove(perm);
    return {
      success: true,
      message: `Permission untuk resource "${resource}" pada Role ID #${roleId} berhasil dihapus (soft delete).`,
    };
  }

  /**
   * Menyalin seluruh hak akses (Permissions) dari Role Sumber ke Role Tujuan.
   */
  async copyRolePermissions(dto: CopyRolePermissionsDto): Promise<{
    success: boolean;
    message: string;
    copiedCount: number;
    targetRoleId: number;
  }> {
    const tenantId = this.tenantContext.getTenantId();
    const { source_role_id, target_role_id, mode = CopyPermissionMode.OVERWRITE } = dto;

    if (source_role_id === target_role_id) {
      throw new BadRequestException('Role sumber dan Role tujuan tidak boleh sama.');
    }

    // 1. Ambil permissions dari role sumber
    const sourcePermissions = await this.permissionRepo.find({
      where: {
        role: { id: source_role_id },
        tenantId: tenantId ? tenantId : undefined,
      },
    });

    if (!sourcePermissions || sourcePermissions.length === 0) {
      throw new NotFoundException(
        `Role sumber dengan ID #${source_role_id} tidak memiliki permission untuk disalin.`,
      );
    }

    // 2. Ambil permissions milik role tujuan saat ini
    const targetPermissions = await this.permissionRepo.find({
      where: {
        role: { id: target_role_id },
        tenantId: tenantId ? tenantId : undefined,
      },
    });

    // 3. Jika mode OVERWRITE, soft remove permission lama milik role tujuan
    if (mode === CopyPermissionMode.OVERWRITE && targetPermissions.length > 0) {
      await this.permissionRepo.softRemove(targetPermissions);
    }

    // 4. Salin permissions dari sumber ke tujuan
    const targetMap = new Map<string, Permission>();
    if (mode === CopyPermissionMode.MERGE) {
      targetPermissions.forEach((p) => targetMap.set(p.resource, p));
    }

    const toSave: Permission[] = [];

    for (const srcPerm of sourcePermissions) {
      if (mode === CopyPermissionMode.MERGE && targetMap.has(srcPerm.resource)) {
        // Mode merge: Update level akses jika resource sudah ada
        const existingPerm = targetMap.get(srcPerm.resource)!;
        existingPerm.accessLevel = srcPerm.accessLevel;
        toSave.push(existingPerm);
      } else {
        // Buat record permission baru untuk role tujuan
        const newPerm = this.permissionRepo.create({
          role: { id: target_role_id },
          resource: srcPerm.resource,
          accessLevel: srcPerm.accessLevel,
          tenantId: tenantId ? tenantId : undefined,
        });
        toSave.push(newPerm);
      }
    }

    if (toSave.length > 0) {
      await this.permissionRepo.save(toSave);
    }

    return {
      success: true,
      message: `Berhasil menyalin ${toSave.length} hak akses dari Role #${source_role_id} ke Role #${target_role_id} (${mode} mode).`,
      copiedCount: toSave.length,
      targetRoleId: target_role_id,
    };
  }
}
