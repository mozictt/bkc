import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Menu } from '@entities/menu.entity';

@Injectable()
export class MenuService {
  constructor(private readonly dataSource: DataSource) {}

  async createMenu(data: Partial<Menu>): Promise<Menu> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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
    const qb = this.dataSource
      .getRepository(Menu)
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.children', 'children')
      .leftJoinAndSelect('menu.parent', 'parent')
      .orderBy('menu.order_no', 'ASC');

    return qb.getMany();
  }
  async getAllMenusByRoleId(id: number): Promise<Menu[]> {
    const qb = this.dataSource
      .getRepository(Menu)
      .createQueryBuilder('menu')
      .innerJoin('menu.roles', 'role')
      .leftJoinAndSelect('menu.children', 'children')
      .leftJoinAndSelect('menu.parent', 'parent')
      .where('role.id = :id', { id })
      .orderBy('menu.order_no', 'ASC');

    const menus = await qb.getMany();
    if (!menus || menus.length === 0) {
      throw new NotFoundException('Data menu tidak ditemukan');
    }
    return menus;
  }

  async getMenuById(id: number): Promise<Menu> {
    const menu = await this.dataSource
      .getRepository(Menu)
      .createQueryBuilder('menu')
      .leftJoinAndSelect('menu.children', 'children')
      .leftJoinAndSelect('menu.parent', 'parent')
      .where('menu.id = :id', { id })
      .getOne();

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
}
