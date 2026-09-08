import { DataSource, IsNull } from 'typeorm';
import { Menu } from '../../entities/menu.entity';
import { Role } from '../../role/entities/role.entity';
import { Permission } from '../../entities/permission.entity';
import { Tenant } from '../../entities/tenant.entity';
import { AccessLevel } from '../../permissions/constants/access-level.constant';
import { MENU_TREE, SUPER_ADMIN_RESOURCES, MenuSeedItem } from './menu-tree.config';
import Redis from 'ioredis';

// ─── Helper Invalidate Cache Redis Menu ─────────────────────────────────────────
async function clearRedisMenuCache() {
  try {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redis = new Redis({ host, port });
    const keys = await redis.keys('menus:*');
    if (keys && keys.length > 0) {
      await redis.del(...keys);
      console.log(`🧹 Cache Redis menu berhasil dibersihkan (${keys.length} keys).`);
    } else {
      console.log('🧹 Cache Redis menu sudah bersih.');
    }
    await redis.quit();
  } catch (err: any) {
    console.warn(`⚠️ Gagal membersihkan cache Redis menu: ${err.message}`);
  }
}

// ─── Helper Rekursif Upsert Menu Tree ──────────────────────────────────────────
async function upsertMenuTree(
  menuRepo: any,
  items: MenuSeedItem[],
  parent: Menu | null = null,
  masterTenant: Tenant | null = null,
  requiredResourcesSet: Set<string> = new Set(),
): Promise<void> {
  const masterTenantId = masterTenant ? masterTenant.id : null;

  for (const item of items) {
    // 1. Pencarian Fleksibel (HANYA untuk Master Tenant atau Global, TIDAK PERNAH menyentuh tenant lain)
    let menu: Menu | null = null;
    if (item.requiredResource) {
      menu = await menuRepo.findOne({
        where: masterTenantId
          ? [
              { requiredResource: item.requiredResource, tenantId: masterTenantId },
              { requiredResource: item.requiredResource, tenantId: IsNull() },
            ]
          : { requiredResource: item.requiredResource, tenantId: IsNull() },
        relations: ['parent'],
      });
    }

    if (!menu && item.url) {
      menu = await menuRepo.findOne({
        where: masterTenantId
          ? [
              { url: item.url, tenantId: masterTenantId },
              { url: item.url, tenantId: IsNull() },
            ]
          : { url: item.url, tenantId: IsNull() },
        relations: ['parent'],
      });
    }

    if (!menu) {
      menu = await menuRepo.findOne({
        where: masterTenantId
          ? [
              { name: item.name, tenantId: masterTenantId },
              { name: item.name, tenantId: IsNull() },
            ]
          : { name: item.name, tenantId: IsNull() },
        relations: ['parent'],
      });
    }

    if (!menu) {
      menu = menuRepo.create({
        name: item.name,
        url: item.url || '',
        icon: item.icon || '',
        order_no: item.order_no,
        requiredResource: (item.requiredResource || null) as any,
        parent: (parent || null) as any,
        tenantId: masterTenantId,
        tenant: (masterTenant || null) as any,
        is_active: true,
        is_visible: true,
      });
      menu = await menuRepo.save(menu);
      console.log(`  ✅ Menu baru dibuat (tenant: ${masterTenantId || 'global'}): "${item.name}"`);
    } else {
      let updated = false;
      if (menu.name !== item.name) {
        console.log(`  ✏️ Mengubah nama menu: "${menu.name}" => "${item.name}"`);
        menu.name = item.name;
        updated = true;
      }
      if (item.url !== undefined && menu.url !== (item.url || '')) {
        menu.url = item.url || '';
        updated = true;
      }
      if (item.icon !== undefined && menu.icon !== (item.icon || '')) {
        menu.icon = item.icon || '';
        updated = true;
      }
      if (item.order_no !== undefined && menu.order_no !== item.order_no) {
        menu.order_no = item.order_no;
        updated = true;
      }
      if (item.requiredResource !== undefined && menu.requiredResource !== (item.requiredResource || null)) {
        menu.requiredResource = (item.requiredResource || null) as any;
        updated = true;
      }
      if (parent ? (!menu.parent || menu.parent.id !== parent.id) : (menu.parent !== null && menu.parent !== undefined)) {
        menu.parent = (parent || null) as any;
        updated = true;
      }
      if (masterTenantId && menu.tenantId !== masterTenantId) {
        menu.tenantId = masterTenantId;
        menu.tenant = (masterTenant || null) as any;
        updated = true;
      }

      if (updated) {
        await menuRepo.save(menu);
        console.log(`  🔄 Menu diperbarui (tenant: ${masterTenantId || 'global'}): "${item.name}"`);
      } else {
        console.log(`  ℹ️ Menu sesuai & aktif: "${item.name}", melewati.`);
      }
    }

    if (item.requiredResource) {
      requiredResourcesSet.add(item.requiredResource);
    }

    if (item.children && item.children.length > 0) {
      await upsertMenuTree(menuRepo, item.children, menu, masterTenant, requiredResourcesSet);
    }
  }
}

// ─── Main Seeder Function ──────────────────────────────────────────────────────
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
  const tenantRepo = dataSource.getRepository(Tenant);

  // --- 0.1 AMBIL MASTER TENANT ---
  const masterTenant = await tenantRepo.findOne({ where: { isMaster: true } });
  if (masterTenant) {
    console.log(`🔑 Master Tenant terdeteksi: "${masterTenant.name}" (id=${masterTenant.id})`);
  } else {
    console.log('ℹ️ Master Tenant belum dibuat. Menu disemai dengan tenantId = null.');
  }

  // --- 0.2 NON-DESTRUCTIVE UPSERT (MENU TENANT LAIN 100% AMAN & TIDAK DIHAPUS) ---
  console.log('🛡️ Memproses seeder menu secara non-destruktif (menu tenant lain 100% aman & tidak akan tersentuh)...');

  // --- 1. SEED MENUS (Recursive Tree dengan Children & Fresh Recreation) ---
  console.log('🌱 Creating fresh Menu Tree (Parent & Children)...');
  const requiredResourcesSet = new Set<string>();
  await upsertMenuTree(menuRepo, MENU_TREE, null, masterTenant, requiredResourcesSet);

  // --- 2. SEED ROLES (Terikat Master Tenant) ---
  let adminRole = await roleRepo.findOne({
    where: masterTenant ? { name: 'Super Admin', tenantId: masterTenant.id } : { name: 'Super Admin' },
  });

  if (!adminRole) {
    adminRole = await roleRepo.save(
      roleRepo.create({
        name: 'Super Admin',
        description: 'Full access to everything',
        tenantId: masterTenant ? masterTenant.id : undefined,
        tenant: masterTenant || undefined,
      }),
    );
    console.log('✅ Role Super Admin created');
  } else {
    console.log('ℹ️ Role Super Admin sudah ada, melewati pembuatan role.');
  }

  let staffRole = await roleRepo.findOne({
    where: masterTenant ? { name: 'Staff', tenantId: masterTenant.id } : { name: 'Staff' },
  });
  if (!staffRole) {
    staffRole = await roleRepo.save(
      roleRepo.create({
        name: 'Staff',
        description: 'Limited operational access',
        tenantId: masterTenant ? masterTenant.id : undefined,
        tenant: masterTenant || undefined,
      }),
    );
    console.log('✅ Role Staff created');
  }

  // --- 3. SEED PERMISSIONS ---
  const allResources = Array.from(
    new Set([
      'Document',
      'User',
      'Role',
      'Menu',
      'Pegawai',
      'Permission',
      'Tenant',
      'Barang',
      'Gallery',
      'CompanyProfile',
      'WhatsApp',
      ...Array.from(requiredResourcesSet),
    ]),
  );

  for (const resource of allResources) {
    const exists = await permissionRepo.findOneBy({
      role: { id: adminRole.id },
      resource,
      tenantId: masterTenant ? masterTenant.id : undefined as any,
    });
    if (!exists) {
      await permissionRepo.save(
        permissionRepo.create({
          role: adminRole,
          resource,
          accessLevel: AccessLevel.FULL_AKSES,
          tenantId: masterTenant ? masterTenant.id : undefined,
          tenant: masterTenant || undefined,
        }),
      );
    }
  }

  // Staff Permissions (View Access untuk Resource Utama)
  const staffResources = ['Document', 'User', 'Role', 'Pegawai'];
  for (const resource of staffResources) {
    const exists = await permissionRepo.findOneBy({
      role: { id: staffRole.id },
      resource,
      tenantId: masterTenant ? masterTenant.id : undefined as any,
    });
    if (!exists) {
      await permissionRepo.save(
        permissionRepo.create({
          role: staffRole,
          resource,
          accessLevel: AccessLevel.VIEW_AKSES,
          tenantId: masterTenant ? masterTenant.id : undefined,
          tenant: masterTenant || undefined,
        }),
      );
    }
  }

  // --- 4. BERSIHKAN CACHE REDIS MENU ---
  await clearRedisMenuCache();

  console.log('✅ Reset & Recreation Menu Seeding completed successfully!');
};
