/**
 * Master Tenant Seeder
 * ────────────────────────────────────────────────────────────────────────────
 * Meng-generate data awal secara ATOMIK dan BERURUTAN:
 *   1. Tenant Master   → UUID auto-generated, isMaster = true
 *   2. Role Super Admin → terikat tenantId master
 *   3. Permissions     → FULL_AKSES untuk semua resource, terikat tenant
 *   4. Menu Tree       → parent-child hierarchy, terikat tenant
 *   5. User Super Admin → username/password dari ENV, terikat tenant & role
 *
 * ⚠️  IDEMPOTENT: Aman dijalankan berulang kali, tidak akan duplikat data.
 * ⚠️  TRANSAKSIONAL: Jika ada kegagalan di tengah, seluruh operasi di-rollback.
 */

import { DataSource, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { AccessLevel } from '../../permissions/constants/access-level.constant';

dotenv.config();

// ─── Konstanta Resource Permission ───────────────────────────────────────────
const SUPER_ADMIN_RESOURCES: string[] = [
  // Entitas utama
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

  // Route-level menu resources
  'menu-album',
  'menu-barang',
  'menu-dashboard',
  'menu-dokumen',
  'menu-galery',
  'menu-list-menu',
  'menu-pegawai-list',
  'menu-profil-pegawai',
  'menu-profil-perusahaan',
  'menu-role',
  'menu-users-list',
  'menu-tenant',
  'menu-whatsapp',
];

// ─── Definisi Menu Tree ───────────────────────────────────────────────────────
interface MenuSeedItem {
  name: string;
  url?: string;
  icon?: string;
  order_no: number;
  requiredResource?: string;
  children?: MenuSeedItem[];
}

const MENU_TREE: MenuSeedItem[] = [
  {
    name: 'Dashboard',
    url: '/dashboard',
    icon: 'home',
    order_no: 1,
    requiredResource: 'menu-dashboard',
  },
  {
    name: 'Dokumen',
    url: '/dokumen',
    icon: 'folder',
    order_no: 2,
    requiredResource: 'menu-dokumen',
  },
  {
    name: 'Galeri',
    url: '/galeri',
    icon: 'image',
    order_no: 3,
    requiredResource: 'menu-galery',
    children: [
      {
        name: 'Album',
        url: '/galeri/album',
        icon: 'albums',
        order_no: 1,
        requiredResource: 'menu-album',
      },
    ],
  },
  {
    name: 'Barang',
    url: '/barang',
    icon: 'cube',
    order_no: 4,
    requiredResource: 'menu-barang',
  },
  {
    name: 'System Management',
    icon: 'settings',
    order_no: 5,
    children: [
      {
        name: 'User Management',
        url: '/users',
        order_no: 1,
        requiredResource: 'menu-users-list',
      },
      {
        name: 'Role Management',
        url: '/roles',
        order_no: 2,
        requiredResource: 'menu-role',
      },
      {
        name: 'Menu Management',
        url: '/menu',
        order_no: 3,
        requiredResource: 'menu-list-menu',
      },
      {
        name: 'Pegawai Management',
        url: '/pegawai',
        order_no: 4,
        requiredResource: 'menu-pegawai-list',
        children: [
          {
            name: 'Profil Pegawai',
            url: '/pegawai/profil',
            order_no: 1,
            requiredResource: 'menu-profil-pegawai',
          },
        ],
      },
      {
        name: 'Profil Perusahaan',
        url: '/company-profile',
        order_no: 5,
        requiredResource: 'menu-profil-perusahaan',
      },
      {
        name: 'Integrasi WhatsApp',
        url: '/whatsapp',
        order_no: 6,
        requiredResource: 'menu-whatsapp',
      },
      {
        name: 'Tenant Management',
        url: '/tenants',
        order_no: 7,
        requiredResource: 'menu-tenant',
      },
    ],
  },
];

// ─── Helper: Upsert Menu Rekursif ─────────────────────────────────────────────
async function upsertMenuTree(
  queryRunner: QueryRunner,
  menus: MenuSeedItem[],
  tenantId: string,
  parentId: number | null = null,
): Promise<void> {
  for (const item of menus) {
    // Cek apakah menu sudah ada berdasarkan name + tenant_id
    const existing = await queryRunner.query(
      `SELECT id FROM menus WHERE name = $1 AND tenant_id = $2 LIMIT 1`,
      [item.name, tenantId],
    );

    let menuId: number;

    if (existing.length === 0) {
      // Insert baru
      const inserted = await queryRunner.query(
        `INSERT INTO menus
           (name, url, icon, order_no, is_active, is_visible, required_resource, parent_id, tenant_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, true, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        [
          item.name,
          item.url ?? null,
          item.icon ?? null,
          item.order_no,
          item.requiredResource ?? null,
          parentId,
          tenantId,
        ],
      );
      menuId = inserted[0].id;
      console.log(`  ✅ Menu inserted: "${item.name}" (id=${menuId})`);
    } else {
      menuId = existing[0].id;
      console.log(`  ℹ️  Menu exists: "${item.name}" (id=${menuId}), skipping.`);
    }

    // Rekursi untuk children
    if (item.children && item.children.length > 0) {
      await upsertMenuTree(queryRunner, item.children, tenantId, menuId);
    }
  }
}

// ─── Main Seeder Function ─────────────────────────────────────────────────────
export async function runMasterTenantSeed(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌱 Master Tenant Seeder – Starting...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: Tenant Master
    // ──────────────────────────────────────────────────────────────────────────
    console.log('📦 [Step 1/5] Seeding Tenant Master...');

    const MASTER_SLUG = process.env.MASTER_TENANT_SLUG ?? 'master';
    const MASTER_NAME = process.env.MASTER_TENANT_NAME ?? 'Master Admin';
    const MASTER_EMAIL = process.env.MASTER_TENANT_EMAIL ?? 'admin@example.com';
    const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    let tenantId: string;

    const existingTenant = await queryRunner.query(
      `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
      [MASTER_SLUG],
    );

    if (existingTenant.length === 0) {
      tenantId = randomUUID();

      await queryRunner.query(
        `INSERT INTO tenants
           (id, name, slug, is_active, email, is_master, parent_id, settings, "expiredAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, $4, true, NULL,
           $5::jsonb,
           NULL, NOW(), NOW())`,
        [
          tenantId,
          MASTER_NAME,
          MASTER_SLUG,
          MASTER_EMAIL,
          JSON.stringify({
            frontendUrl: FRONTEND_URL,
            allowedModules: ['*'],
            maxUsers: null, // unlimited
            timezone: process.env.APP_TIMEZONE ?? 'Asia/Jakarta',
          }),
        ],
      );
      console.log(`  ✅ Tenant master created: "${MASTER_NAME}" (id=${tenantId})`);
    } else {
      tenantId = existingTenant[0].id;
      console.log(`  ℹ️  Tenant master exists (id=${tenantId}), skipping creation.`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: Role Super Admin (terikat tenant master)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📦 [Step 2/5] Seeding Role Super Admin...');

    let superAdminRoleId: number;

    const existingRole = await queryRunner.query(
      `SELECT id FROM roles WHERE name = $1 AND tenant_id = $2 LIMIT 1`,
      ['Super Admin', tenantId],
    );

    if (existingRole.length === 0) {
      const insertedRole = await queryRunner.query(
        `INSERT INTO roles (name, description, tenant_id, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        ['Super Admin', 'Full access to all system resources', tenantId],
      );
      superAdminRoleId = insertedRole[0].id;
      console.log(`  ✅ Role "Super Admin" created (id=${superAdminRoleId})`);
    } else {
      superAdminRoleId = existingRole[0].id;
      console.log(`  ℹ️  Role "Super Admin" exists (id=${superAdminRoleId}), skipping.`);
    }

    // Role Staff (terikat tenant master)
    const existingStaffRole = await queryRunner.query(
      `SELECT id FROM roles WHERE name = $1 AND tenant_id = $2 LIMIT 1`,
      ['Staff', tenantId],
    );

    if (existingStaffRole.length === 0) {
      await queryRunner.query(
        `INSERT INTO roles (name, description, tenant_id, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        ['Staff', 'Limited operational access', tenantId],
      );
      console.log(`  ✅ Role "Staff" created`);
    } else {
      console.log(`  ℹ️  Role "Staff" exists, skipping.`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: Permissions Super Admin
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📦 [Step 3/5] Seeding Permissions...');

    let permInserted = 0;
    for (const resource of SUPER_ADMIN_RESOURCES) {
      const existingPerm = await queryRunner.query(
        `SELECT id FROM permissions WHERE role_id = $1 AND resource = $2 AND tenant_id = $3 LIMIT 1`,
        [superAdminRoleId, resource, tenantId],
      );

      if (existingPerm.length === 0) {
        await queryRunner.query(
          `INSERT INTO permissions (role_id, resource, "accessLevel", tenant_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [superAdminRoleId, resource, AccessLevel.FULL_AKSES, tenantId],
        );
        permInserted++;
      }
    }
    console.log(
      `  ✅ ${permInserted} permissions inserted, ${SUPER_ADMIN_RESOURCES.length - permInserted} already existed.`,
    );

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: Menu Tree
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📦 [Step 4/5] Seeding Menu Tree...');
    await upsertMenuTree(queryRunner, MENU_TREE, tenantId);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: User Super Admin
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📦 [Step 5/5] Seeding User Super Admin...');

    const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME ?? 'superadmin';
    const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin@123!';
    const SALT_ROUNDS = 12;

    const existingUser = await queryRunner.query(
      `SELECT id FROM users WHERE username = $1 AND tenant_id = $2 LIMIT 1`,
      [SUPER_ADMIN_USERNAME, tenantId],
    );

    if (existingUser.length === 0) {
      const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, SALT_ROUNDS);

      await queryRunner.query(
        // Nama kolom mengikuti TypeORM entity:
        //   - is_active  → @Column({ name: 'is_active' })
        //   - "refreshToken" → @Column tanpa name decorator (TypeORM pakai camelCase)
        //   - pegawai_id → @Column({ name: 'pegawai_id' })
        `INSERT INTO users
           (username, password, role_id, is_active, "refreshToken", pegawai_id, tenant_id, created_at, updated_at)
         VALUES ($1, $2, $3, true, NULL, NULL, $4, NOW(), NOW())`,
        [SUPER_ADMIN_USERNAME, hashedPassword, superAdminRoleId, tenantId],
      );
      console.log(`  ✅ User Super Admin created: "${SUPER_ADMIN_USERNAME}"`);
      console.log(`  ⚠️  Password default digunakan – SEGERA ubah via aplikasi!`);
    } else {
      console.log(`  ℹ️  User "${SUPER_ADMIN_USERNAME}" exists, skipping.`);
    }

    // ─── Commit Transaction ───────────────────────────────────────────────────
    await queryRunner.commitTransaction();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏁 Master Tenant Seeder – Completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('\n❌ Master Tenant Seeder FAILED – Transaction rolled back!');
    console.error(error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}
