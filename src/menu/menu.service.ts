import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Menu } from '@entities/menu.entity';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { RoleMenuPermission } from '@entities/role-menu-permissions.entity';
import { UpdatePermissionDto } from './dto/update-permission.dto'; 
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';


export class MenuService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    @InjectRepository(RoleMenuPermission)
    private readonly permissionRepo: Repository<RoleMenuPermission>,
    @InjectRepository(Menu)
    private readonly menuRepository: Repository<Menu>,
  ) { }

  async createMenu(data: CreateMenuDto): Promise<Menu> {
    const tenantId = this.tenantContext.getTenantId();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Gabungkan tenantId ke dalam payload agar tidak melanggar strict type dari DTO
      const payload = tenantId ? { ...data, tenantId } : data;

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

  async getAllMenusByRoleId(id: number): Promise<any[]> {
    const tenantId = this.tenantContext.getTenantId();

    try {
      const qb = this.dataSource
        .getRepository(Menu)
        .createQueryBuilder('menu')
        .innerJoinAndSelect('menu.permissions', 'rmp')
        .innerJoin('rmp.role', 'role')
        .leftJoinAndSelect('menu.parent', 'parent') // 🔥 Wajib Left Join ke Parent
        .where('role.id = :id', { id })
        .andWhere('menu.is_active = :isActive', { isActive: true }); // Pastikan menu aktif

      if (tenantId) {
        qb.andWhere('menu.tenantId = :tenantId', { tenantId });
      }

      qb.orderBy('parent.id', 'ASC', 'NULLS FIRST')
        .addOrderBy('menu.order_no', 'ASC');

      const flatMenus = await qb.getMany();
      if (!flatMenus || flatMenus.length === 0) {
        throw new NotFoundException(`Tidak ada menu untuk Role #${id}`);
      }

      return this.buildMenuTree(flatMenus);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Gagal mengambil data menu');
    }
  }

  /**
   * Helper internal untuk membangun struktur Nested Tree / Hirarki Menu
   */
  private buildMenuTree(flatMenus: Menu[]): any[] {
    const menuMap = new Map<number, any>();
    const rootMenus: any[] = [];

    // 1. Petakan semua menu ke dalam Map & tambahkan properti 'children'
    flatMenus.forEach((menu) => {
      // Saring data sensitif, kirim struktur bersih untuk frontend
      const menuItem = {
        id: menu.id,
        name: menu.name,
        icon: menu.icon,
        url: menu.url,
        order_no: menu.order_no,
        is_visible: menu.is_visible,
        actions: menu.permissions ? menu.permissions.map((p) => p.actions).flat() : [], 
        children: [],
      };
      menuMap.set(menu.id, menuItem);
    });

    // 2. Hubungkan Child ke Parent
    flatMenus.forEach((menu) => {
      const mappedMenu = menuMap.get(menu.id);

      if (menu.parent && menuMap.has(menu.parent.id)) {
        // Jika punya parent, masukkan ke array children milik parent-nya
        const parentMenu = menuMap.get(menu.parent.id);
        parentMenu.children.push(mappedMenu);
      } else {
        // Jika tidak punya parent (atau parent tidak dizinkan untuk role ini), jadikan root menu
        rootMenus.push(mappedMenu);
      }
    });

    // Urutkan root menu berdasarkan order_no
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
      const menu = await repo.findOneBy({ id });
      if (!menu) throw new NotFoundException('Menu not found');

      const updated = repo.merge(menu, updateData);
      await repo.save(updated);

      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
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
  async updateRoleMenuPermission(
    dto: UpdatePermissionDto,
  ): Promise<RoleMenuPermission> {
    const { roleId, menuId, actions } = dto;
    const tenantId = this.tenantContext.getTenantId();
    try {
      // 1. Cari apakah permission untuk role dan menu ini sudah pernah dibuat
      let permission: RoleMenuPermission | null =
        await this.permissionRepo.findOne({
          where: {
            role: { id: roleId },
            menu: { id: menuId },
            tenantId,
          },
        });

      if (permission) {
        // 2. Jika sudah ada, tinggal update array actions-nya
        permission.actions = actions;
      } else {
        // 3. Jika belum ada, buat entity baru dan pasang relasinya
        permission = this.permissionRepo.create({
          role: { id: roleId },
          menu: { id: menuId },
          actions,
          tenantId, // Inject tenantId here
        });
      }

      // 4. Simpan perubahan ke database
      return await this.permissionRepo.save(permission);
    } catch (unknownError: unknown) {
      // 1. Definisikan tipe catch secara eksplisit sebagai unknown (standar TS modern)
      // 2. Lemparkan kembali (throw) error agar return type Promise<RoleMenuPermission> terpenuhi
      if (unknownError instanceof Error) {
        console.error(unknownError.message);
        throw new InternalServerErrorException(unknownError.message);
      }

      console.error('Terjadi error yang tidak diketahui', unknownError);
      throw new InternalServerErrorException('Terjadi kesalahan pada server');
    }
  }
}
