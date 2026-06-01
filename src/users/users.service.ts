// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // async findByUsername(username: string) {
  //   return this.userRepo.findOne({ where: { username } });
  // }
  async findByUsername(username: string) {
    return this.userRepo.findOne({
      where: { username },
      relations: [
        'role',
        'tenant',
        'role.permissions',
        'role.permissions.menu',
        'role.permissions.menu.parent',
        'role.permissions.menu.children',
      ],
    });
  }

  async findById(id: number) {
    return this.userRepo.findOne({
      where: { id },
      relations: [
        'role',
        'tenant',
        'role.permissions',
        'role.permissions.menu',
        'role.permissions.menu.parent',
        'role.permissions.menu.children',
      ],
    });
  }

  // user/services/user.service.ts
  async findUserWithPermissions(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role', 'role.permissions', 'role.permissions.menu'],
    });
    if (!user) return null;
    // console.log(user);

    // Gunakan fungsi mapMenus yang sudah kita buat sebelumnya untuk memformat data
    const formattedMenus = this.mapMenus(user.role.permissions);
    // console.log(formattedMenus);

    return {
      ...user,
      menus: formattedMenus,
    };
  }
  async updateRefreshToken(userId: number, token: string) {
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
    });
    return this.userRepo.save(user);
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
