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

export class MenuService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) { }

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
    const qb = this.dataSource
      .getRepository(Menu)
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.children', 'children')
      .leftJoinAndSelect('menu.parent', 'parent');

    if (tenantId) {
      qb.andWhere('menu.tenantId = :tenantId', { tenantId });
    }
    qb.andWhere('menu.parent is null '); 
    qb.orderBy('menu.order_no', 'ASC');

    return qb.getMany();
  }

  async getAllMenusByRoleId(id: number, explicitTenantId?: string): Promise<any[]> {
    const tenantId = explicitTenantId || this.tenantContext.getTenantId();

    try {
      // 1. Get all resources assigned to this role
      const permissions = await this.permissionRepo.find({
        where: {
          role: { id },
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
        .addOrderBy('menu.order_no', 'ASC');

      const flatMenus = await qb.getMany();
      
      // 3. Inject accessLevel into menu based on permissions
      const flatMenusWithPermissions = flatMenus.map(menu => {
        let accessLevel = null;
        if (menu.requiredResource) {
          const perm = permissions.find(p => p.resource === menu.requiredResource);
          if (perm && perm.accessLevel) {
             accessLevel = perm.accessLevel;
          }
        }
        return { ...menu, accessLevel };
      });

      return this.buildMenuTree(flatMenusWithPermissions);
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

    return rootMenus.sort((a, b) => a.order_no - b.order_no);
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

      return await this.permissionRepo.save(permission);
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
