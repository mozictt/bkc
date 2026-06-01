import { DataSource } from 'typeorm';
import { Menu } from '../../entities/menu.entity';
import { Role } from '../../role/entities/role.entity';
import { RoleMenuPermission } from '../../entities/role-menu-permissions.entity';
import { MenuAction } from '../../entities/enums/menu-action.enum';

export const runMenuSeed = async (dataSource: DataSource) => {
  const menuRepo = dataSource.getRepository(Menu);
  const roleRepo = dataSource.getRepository(Role);
  const permissionRepo = dataSource.getRepository(RoleMenuPermission);

  // --- 1. SEED MENUS (Parent & Children) ---
  let dashboard = await menuRepo.findOneBy({ name: 'Dashboard' });
  if (!dashboard) {
    dashboard = await menuRepo.save(
      menuRepo.create({
        name: 'Dashboard',
        url: '/dashboard',
        icon: 'home',
        order_no: 1,
      }),
    );
  }

  let systemMgmt = await menuRepo.findOneBy({ name: 'System Management' });
  if (!systemMgmt) {
    systemMgmt = await menuRepo.save(
      menuRepo.create({
        name: 'System Management',
        icon: 'settings',
        order_no: 2,
      }),
    );
  }

  let userMenu = await menuRepo.findOneBy({ name: 'User Management' });
  if (!userMenu) {
    userMenu = await menuRepo.save(
      menuRepo.create({
        name: 'User Management',
        url: '/users',
        parent: dashboard, // Child dari Dashboard
        order_no: 1,
      }),
    );
  }

  // --- 2. SEED ROLES ---
  let adminRole = await roleRepo.findOne({ where: { name: 'Super Admin' } });

  if (!adminRole) {
    adminRole = await roleRepo.save(
      roleRepo.create({
        name: 'Super Admin',
        description: 'Full access to everything',
      }),
    );
    console.log('✅ Role Super Admin created');
  } else {
    console.log('ℹ️ Role Super Admin already exists, skipping...');
  }

  let staffRole = await roleRepo.findOneBy({ name: 'Staff' });
  if (!staffRole) {
    staffRole = await roleRepo.save(
      roleRepo.create({
        name: 'Staff',
        description: 'Limited operational access',
      }),
    );
  }

  // --- 3. SEED PERMISSIONS (The Array Enum Part) ---

  // Permission untuk Super Admin (Semua Akses)
  const adminPermissions = [
    {
      role: adminRole,
      menu: dashboard,
      actions: [MenuAction.VIEW],
    },
    {
      role: adminRole,
      menu: userMenu,
      actions: [
        MenuAction.VIEW,
        MenuAction.CREATE,
        MenuAction.UPDATE,
        MenuAction.DELETE,
      ],
    },
  ];

  // Permission untuk Staff (Hanya View & Update)
  const staffPermissions = [
    {
      role: staffRole,
      menu: dashboard,
      actions: [MenuAction.VIEW],
    },
    {
      role: staffRole,
      menu: userMenu,
      actions: [MenuAction.VIEW, MenuAction.UPDATE],
    },
  ];

  for (const perm of [...adminPermissions, ...staffPermissions]) {
    const exists = await permissionRepo.findOneBy({
      role: { id: perm.role.id },
      menu: { id: perm.menu.id },
    });
    if (!exists) {
      await permissionRepo.save(permissionRepo.create(perm));
    }
  }

  console.log('✅ Seeding completed!');
};
