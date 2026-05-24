import { 
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  InjectRepository,
  InternalServerErrorException,
} from '@nestjs/typeorm';
import { Menu } from '@entities/menu.entity';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { RoleMenuPermission } from '@entities/role-menu-permissions.entity';
import { UpdatePermissionDto } from './dto/update-permission.dto';
 
export class MenuService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    @InjectRepository(RoleMenuPermission)
    private readonly permissionRepo: Repository<RoleMenuPermission>,
  ) {}

  async createMenu(data: Partial<Menu>): Promise<Menu> {
    const tenantId = this.tenantContext.getTenantId();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Pastikan tenantId ikut tersimpan saat create
      if (tenantId) data.tenantId = tenantId;

      const menu = queryRunner.manager.create(Menu, data);
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

    qb.orderBy('menu.order_no', 'ASC');

    return qb.getMany();
  }

  async getAllMenusByRoleId(id: number): Promise<Menu[]> {
    const tenantId = this.tenantContext.getTenantId();

    try {
      const qb = this.dataSource
        .getRepository(Menu)
        .createQueryBuilder('menu')
        .innerJoinAndSelect('menu.permissions', 'rmp')
        .innerJoin('rmp.role', 'role')
        .where('role.id = :id', { id });

      if (tenantId) {
        qb.andWhere('menu.tenantId = :tenantId', { tenantId });
      }

      qb.orderBy('menu.order_no', 'ASC');

      const menus = await qb.getMany();
      if (!menus || menus.length === 0) {
        throw new NotFoundException('Data menu tidak ditemukan');
      }
      return menus;
    } catch (error) {
      // 3. Catch akan menangkap eror apa pun yang terjadi di dalam blok try
      console.error('--- ERROR TERDETEKSI DI GETALLMENUS ---');
      console.error(error);
      throw error; // Lempar kembali eror agar tidak tertelan
    }
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

  async updateMenu(id: number, updateData: Partial<Menu>): Promise<Menu> {
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
    try {
      // 1. Cari apakah permission untuk role dan menu ini sudah pernah dibuat
      let permission: RoleMenuPermission | null =
        await this.permissionRepo.findOne({
          where: {
            role: { id: roleId },
            menu: { id: menuId },
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
