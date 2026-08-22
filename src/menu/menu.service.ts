import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Menu } from '@entities/menu.entity';
import { Role } from '../role/entities/role.entity';
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
      .leftJoinAndSelect('menu.parent', 'parent');

    if (tenantId) {
      qb.andWhere('menu.tenantId = :tenantId', { tenantId });
    }

    qb.orderBy('parent.id', 'ASC', 'NULLS FIRST')
      .addOrderBy('menu.order_no', 'ASC')
      .addOrderBy('menu.name', 'ASC');

    const flatMenus = await qb.getMany();
    const menus = this.buildMenuTree(flatMenus);

    try {
      await this.redis.set(cacheKey, JSON.stringify(menus), 'EX', 3600);
    } catch (err) {
      console.error('[MenuService] Gagal menyimpan cache menus:all:', err);
    }

    return menus;
  }

  async getAllMenusByRoleId(id: number, explicitTenantId?: string): Promise<any[]> {
    const tenantId = explicitTenantId || this.tenantContext.getTenantId();

    try {
      let targetRoleId = id;
      let originalRoleTenantId: string | undefined = undefined;

      const currentRole = await this.dataSource
        .getRepository(Role)
        .createQueryBuilder('role')
        .where('role.id = :id', { id })
        .getOne();

      if (currentRole) {
        originalRoleTenantId = currentRole.tenantId;

        if (tenantId && currentRole.tenantId !== tenantId) {
          const matchingTenantRole = await this.dataSource
            .getRepository(Role)
            .createQueryBuilder('role')
            .where('LOWER(role.name) = LOWER(:name)', { name: currentRole.name })
            .andWhere('role.tenantId = :tenantId', { tenantId })
            .getOne();

          if (matchingTenantRole) {
            targetRoleId = matchingTenantRole.id;
          }
        }
      }

      // 1. Get all resources assigned to this role in active tenant (or original role tenant)
      const permissionWhere: any[] = [{ role: { id: targetRoleId } }];
      if (tenantId) {
        permissionWhere[0].tenantId = tenantId;
        if (originalRoleTenantId && originalRoleTenantId !== tenantId) {
          permissionWhere.push({ role: { id: targetRoleId }, tenantId: originalRoleTenantId });
        }
      }

      const permissions = await this.permissionRepo.find({
        where: permissionWhere,
      });

      // 2. Query ALL Menus (tanpa filter allowedResources agar bisa digunakan untuk Role Management UI)
      const qb = this.dataSource
        .getRepository(Menu)
        .createQueryBuilder('menu')
        .leftJoinAndSelect('menu.parent', 'parent')
        .where('menu.is_active = :isActive', { isActive: true });

      const isMaster = this.tenantContext.getIsMaster();

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
          accessLevel = AccessLevel.FULL_AKSES;
        } else if (menu.requiredResource) {
          const targetReqResource = menu.requiredResource.trim().toLowerCase();
          const perm = permissions.find(
            p => p.resource && p.resource.trim().toLowerCase() === targetReqResource
          );
          if (perm && perm.accessLevel) {
             accessLevel = perm.accessLevel;
          }
        }
        return { ...menu, accessLevel };
      });

      const tree = this.buildMenuTree(flatMenusWithPermissions);

      return tree;

      return tree;
    } catch (error) {
      console.error('[MenuService Error]', error);
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
        is_active: menu.is_active ?? true,
        is_visible: menu.is_visible ?? true,
        requiredResource: menu.requiredResource || null,
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

    // Pengurutan rekursif berdasarkan order_no & nama di semua tingkatan submenu (Level 1, 2, 3, dst.)
    const sortTree = (nodes: any[]) => {
      nodes.sort((a, b) => (a.order_no ?? 1) - (b.order_no ?? 1) || a.name.localeCompare(b.name));
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          sortTree(node.children);
        }
      });
    };

    sortTree(rootMenus);

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
