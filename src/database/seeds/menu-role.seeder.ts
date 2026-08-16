import { DataSource } from 'typeorm';
import { Menu } from '../../entities/menu.entity';
import { Role } from '../../role/entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { AccessLevel } from '../../permissions/constants/access-level.constant';

export const runMenuSeed = async (dataSource: DataSource) => {
  // --- 0. FIX SCHEMA MISMATCH (UUID -> INT) ---
  try {
    const checkCol = await dataSource.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'documents' AND column_name = 'uploaded_by_id'
    `);
    if (checkCol.length > 0 && checkCol[0].data_type === 'uuid') {
      console.log('⚠️ Terdeteksi tipe kolom UUID lama untuk uploaded_by_id. Menghapus tabel documents untuk pembuatan ulang...');
      await dataSource.query(`DROP TABLE IF EXISTS documents CASCADE;`);
      console.log('✅ Tabel documents berhasil dihapus.');
    }
  } catch (error) {
    console.warn('⚠️ Gagal memeriksa/menghapus tabel documents lama:', error);
  }

  const menuRepo = dataSource.getRepository(Menu);
  const roleRepo = dataSource.getRepository(Role);
  const permissionRepo = dataSource.getRepository(Permission);

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

  let dokumen = await menuRepo.findOneBy({ name: 'Dokumen' });
  if (!dokumen) {
    dokumen = await menuRepo.save(
      menuRepo.create({
        name: 'Dokumen',
        url: '/dokumen',
        icon: 'folder',
        requiredResource: 'Document',
        order_no: 2,
      }),
    );
  }

  let systemMgmt = await menuRepo.findOneBy({ name: 'System Management' });
  if (!systemMgmt) {
    systemMgmt = await menuRepo.save(
      menuRepo.create({
        name: 'System Management',
        icon: 'settings',
        order_no: 3,
      }),
    );
  }

  let userMenu = await menuRepo.findOneBy({ name: 'User Management' });
  if (!userMenu) {
    userMenu = await menuRepo.save(
      menuRepo.create({
        name: 'User Management',
        url: '/users',
        parent: systemMgmt, // Child dari System Management
        requiredResource: 'User',
        order_no: 1,
      }),
    );
  }

  let roleMenu = await menuRepo.findOneBy({ name: 'Role Management' });
  if (!roleMenu) {
    roleMenu = await menuRepo.save(
      menuRepo.create({
        name: 'Role Management',
        url: '/roles',
        parent: systemMgmt,
        requiredResource: 'Role',
        order_no: 2,
      }),
    );
  }

  let menuMgmt = await menuRepo.findOneBy({ name: 'Menu Management' });
  if (!menuMgmt) {
    menuMgmt = await menuRepo.save(
      menuRepo.create({
        name: 'Menu Management',
        url: '/menu',
        parent: systemMgmt,
        requiredResource: 'Menu',
        order_no: 3,
      }),
    );
  }

  let pegawaiMenu = await menuRepo.findOneBy({ name: 'Pegawai Management' });
  if (!pegawaiMenu) {
    pegawaiMenu = await menuRepo.save(
      menuRepo.create({
        name: 'Pegawai Management',
        url: '/pegawai',
        parent: systemMgmt,
        requiredResource: 'Pegawai',
        order_no: 4,
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

  // --- 3. SEED PERMISSIONS ---
  const defaultPermissions = [
    // Super Admin Permissions (Semua Akses)
    {
      role: adminRole,
      resource: 'Document',
      accessLevel: AccessLevel.FULL_AKSES,
    },
    {
      role: adminRole,
      resource: 'User',
      accessLevel: AccessLevel.FULL_AKSES,
    },
    {
      role: adminRole,
      resource: 'Role',
      accessLevel: AccessLevel.FULL_AKSES,
    },
    {
      role: adminRole,
      resource: 'Menu',
      accessLevel: AccessLevel.FULL_AKSES,
    },
    {
      role: adminRole,
      resource: 'Pegawai',
      accessLevel: AccessLevel.FULL_AKSES,
    },
    {
      role: adminRole,
      resource: 'Permission',
      accessLevel: AccessLevel.FULL_AKSES,
    },

    // Staff Permissions (Hanya View/Akses Terbatas)
    {
      role: staffRole,
      resource: 'Document',
      accessLevel: AccessLevel.VIEW_AKSES,
    },
    {
      role: staffRole,
      resource: 'User',
      accessLevel: AccessLevel.VIEW_AKSES,
    },
    {
      role: staffRole,
      resource: 'Role',
      accessLevel: AccessLevel.VIEW_AKSES,
    },
    {
      role: staffRole,
      resource: 'Pegawai',
      accessLevel: AccessLevel.VIEW_AKSES,
    },
  ];

  for (const perm of defaultPermissions) {
    const exists = await permissionRepo.findOneBy({
      role: { id: perm.role.id },
      resource: perm.resource,
    });
    if (!exists) {
      await permissionRepo.save(permissionRepo.create(perm));
    }
  }

  console.log('✅ Seeding completed!');
};
