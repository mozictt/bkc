import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Menu } from '@entities/menu.entity';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { Permission } from '@entities/permission.entity';
import { UpdatePermissionDto } from './dto/update-permission.dto'; 
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { AccessLevel, AccessLevelMapping } from '../permissions/constants/access-level.constant';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export class MenuService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
    @InjectRedis() private readonly redis: Redis,
  ) { }

  private async invalidateMenuCache(): Promise<void> {
    try {
      const keys = await this.redis.keys('menus:*');
      if (keys && keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      console.error('[MenuService] Gagal membersihkan cache menu:', err);
    }
  }

  async createMenu(data: CreateMenuDto): Promise<Menu> {
    const tenantId = this.tenantContext.getTenantId();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { parent_id, ...rest } = data;
      const payload: any = tenantId ? { ...rest, tenantId } : { ...rest };

      if (parent_id) {
        const parentMenu = await queryRunner.manager.findOneBy(Menu, { id: parent_id });
        if (parentMenu) {
          payload.parent = parentMenu;
        }
      }

      const menu = queryRunner.manager.create(Menu, payload);
      await queryRunner.manager.save(Menu, menu);
      await queryRunner.commitTransaction();
      await this.invalidateMenuCache();
      return menu;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to create menu');
    } finally {
      await queryRunner.release();
    }
  }

  async getAllMenus(): Promise<Menu[]> {
    const tenantId = this.tenantContext.getTenantId();
    const cacheKey = `menus:all:${tenantId || 'global'}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('[MenuService] Gagal mengambil cache menus:all:', err);
    }

    const qb = this.dataSource
      .getRepository(Menu)
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.children', 'children')
      .leftJoinAndSelect('menu.parent', 'parent');

    if (tenantId) {
      qb.andWhere('menu.tenantId = :tenantId', { tenantId });
    }
    qb.andWhere('menu.parent is null '); 
    qb.orderBy('menu.name', 'ASC');

    const menus = await qb.getMany();

    menus.forEach(menu => {
      if (menu.children && menu.children.length > 0) {
        menu.children.sort((a, b) => a.name.localeCompare(b.name));
      }
    });

    try {
      await this.redis.set(cacheKey, JSON.stringify(menus), 'EX', 3600);
    } catch (err) {
      console.error('[MenuService] Gagal menyimpan cache menus:all:', err);
    }

    return menus;
  }

  async getAllMenusByRoleId(id: number, explicitTenantId?: string): Promise<any[]> {
    const tenantId = explicitTenantId || this.tenantContext.getTenantId();
    const cacheKey = `menus:role:${id}:${tenantId || 'global'}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('[MenuService] Gagal mengambil cache menus:role:', err);
    }

    try {
      let targetRoleId = id;

      // 🔍 Resolusi Role per-Tenant: Jika role ID berasal dari tenant lain (misal Master Tenant),
      // temukan role dengan NAMA yang sama pada active tenant!
      if (tenantId) {
        const roleRepo = this.dataSource.getRepository(Role);
        const currentRole = await roleRepo.findOne({ where: { id } });
        if (currentRole && currentRole.tenantId !== tenantId) {
          const matchingTenantRole = await roleRepo.findOne({
            where: { name: currentRole.name, tenantId },
          });
          if (matchingTenantRole) {
            targetRoleId = matchingTenantRole.id;
          }
        }
      }

      // 1. Get all resources assigned to this role in active tenant
      const permissions = await this.permissionRepo.find({
        where: {
          role: { id: targetRoleId },
          tenantId: tenantId ? tenantId : undefined,
        },
      });

      // 2. Query ALL Menus (tanpa filter allowedResources agar bisa digunakan untuk Role Management UI)
      const qb = this.dataSource
        .getRepository(Menu)
        .createQueryBuilder('menu')
        .leftJoinAndSelect('menu.parent', 'parent')
        .where('menu.is_active = :isActive', { isActive: true });

      if (tenantId) {
        qb.andWhere('menu.tenantId = :tenantId', { tenantId });
      }

      qb.orderBy('parent.id', 'ASC', 'NULLS FIRST')
        .addOrderBy('menu.name', 'ASC');

      const flatMenus = await qb.getMany();
      
      const isSuperAdmin = this.tenantContext.getIsMaster() && 
        String(this.tenantContext.getRole()).trim().toLowerCase() === 'super admin';

      // 3. Inject accessLevel into menu based on permissions
      const flatMenusWithPermissions = flatMenus.map(menu => {
        let accessLevel: AccessLevel | null = null;
        if (isSuperAdmin) {
          accessLevel = AccessLevel.WRITE;
        } else if (menu.requiredResource) {
          const perm = permissions.find(p => p.resource === menu.requiredResource);
          if (perm && perm.accessLevel) {
             accessLevel = perm.accessLevel;
          }
        }
        return { ...menu, accessLevel };
      });

      const tree = this.buildMenuTree(flatMenusWithPermissions);

      try {
        await this.redis.set(cacheKey, JSON.stringify(tree), 'EX', 3600);
      } catch (err) {
        console.error('[MenuService] Gagal menyimpan cache menus:role:', err);
      }

      return tree;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Gagal mengambil data menu');
    }
  }

  private buildMenuTree(flatMenus: any[]): any[] {
    const menuMap = new Map<number, any>();
    const rootMenus: any[] = [];

    flatMenus.forEach((menu) => {
      const menuItem = {
        id: menu.id,
        name: menu.name,
        icon: menu.icon,
        url: menu.url,
        order_no: menu.order_no,
        is_visible: menu.is_visible,
        accessLevel: menu.accessLevel || null, 
        children: [],
      };
      menuMap.set(menu.id, menuItem);
    });

    flatMenus.forEach((menu) => {
      const mappedMenu = menuMap.get(menu.id);

      if (menu.parent && menuMap.has(menu.parent.id)) {
        const parentMenu = menuMap.get(menu.parent.id);
        parentMenu.children.push(mappedMenu);
      } else {
        rootMenus.push(mappedMenu);
      }
    });

    // Urutkan root menus berdasarkan nama ascending
    rootMenus.sort((a, b) => a.name.localeCompare(b.name));

    // Urutkan children dari masing-masing root menu berdasarkan nama ascending
    rootMenus.forEach((menu) => {
      if (menu.children && menu.children.length > 0) {
        menu.children.sort((a, b) => a.name.localeCompare(b.name));
      }
    });

    return rootMenus;
  }

  async getMenuById(id: number): Promise<Menu> {
    const tenantId = this.tenantContext.getTenantId();

    const qb = this.dataSource
      .getRepository(Menu)
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.children', 'children')
      .leftJoinAndSelect('menu.parent', 'parent')
      .where('menu.id = :id', { id });

    if (tenantId) {
      qb.andWhere('menu.tenantId = :tenantId', { tenantId });
    }

    const menu = await qb.getOne();

    if (!menu) throw new NotFoundException('Menu not found');
    return menu;
  }

  async updateMenu(id: number, updateData: UpdateMenuDto): Promise<Menu> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const repo = queryRunner.manager.getRepository(Menu);
      const menu = await repo.findOne({
        where: { id },
        relations: ['parent'],
      });
      if (!menu) throw new NotFoundException('Menu not found');

      const { parent_id, ...rest } = updateData;

      if (parent_id !== undefined) {
        if (parent_id === id) {
          throw new BadRequestException('Menu tidak bisa menjadi parent untuk dirinya sendiri');
        }
        if (parent_id) {
          const parentMenu = await repo.findOneBy({ id: parent_id });
          if (!parentMenu) throw new NotFoundException('Parent menu tidak ditemukan');
          menu.parent = parentMenu;
        } else {
          menu.parent = null as any;
        }
      }

      const updated = repo.merge(menu, rest);
      await repo.save(updated);

      await queryRunner.commitTransaction();
      await this.invalidateMenuCache();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException('Failed to update menu');
    } finally {
      await queryRunner.release();
    }
  }

  async deleteMenu(id: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const menu = await queryRunner.manager.findOne(Menu, { where: { id } });
      if (!menu) throw new NotFoundException('Menu not found');

      await queryRunner.manager.remove(Menu, menu);
      await queryRunner.commitTransaction();
      await this.invalidateMenuCache();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to delete menu');
    } finally {
      await queryRunner.release();
    }
  }

  // NOTE: This might need to be refactored or moved to a PermissionService later.
  async updateRoleMenuPermission(
    dto: any, // Use any for now since UpdatePermissionDto needs refactoring
  ): Promise<Permission> {
    const { roleId, resource, accessLevel } = dto;
    const tenantId = this.tenantContext.getTenantId();
    try {
      let permission: Permission | null =
        await this.permissionRepo.findOne({
          where: {
            role: { id: roleId },
            resource,
            tenantId,
          },
        });

      if (permission) {
        permission.accessLevel = accessLevel as AccessLevel;
      } else {
        permission = this.permissionRepo.create({
          role: { id: roleId },
          resource,
          accessLevel: accessLevel as AccessLevel,
          tenantId,
        });
      }

      const savedPermission = await this.permissionRepo.save(permission);
      await this.invalidateMenuCache();
      return savedPermission;
    } catch (unknownError: unknown) {
      if (unknownError instanceof Error) {
        console.error(unknownError.message);
        throw new InternalServerErrorException(unknownError.message);
      }

      console.error('Terjadi error yang tidak diketahui', unknownError);
      throw new InternalServerErrorException('Terjadi kesalahan pada server');
    }
  }
}
