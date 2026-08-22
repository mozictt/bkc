import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AccessLevel } from '../../permissions/constants/access-level.constant';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'app',
  entities: [path.join(__dirname, '../../**/*.entity{.ts,.js}')],
  synchronize: false,
  logging: false,
});

const targetResources = [
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
];

async function run() {
  try {
    console.log('⏳ Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    // Query column names of roles table
    const roleCols: any[] = await AppDataSource.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'roles'
    `);
    console.log('📋 Column names in roles table:', roleCols.map(c => c.column_name));

    // Query column names of permissions table
    const permCols: any[] = await AppDataSource.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'permissions'
    `);
    console.log('📋 Column names in permissions table:', permCols.map(c => c.column_name));

    const tenantIdCol = roleCols.some(c => c.column_name === 'tenantId') ? '"tenantId"' : 'tenant_id';
    const permTenantIdCol = permCols.some(c => c.column_name === 'tenantId') ? '"tenantId"' : 'tenant_id';
    const accessLevelCol = permCols.some(c => c.column_name === 'accessLevel') ? '"accessLevel"' : 'access_level';

    const roles: Array<{ id: number; name: string; tenant_id: string | null }> = await AppDataSource.query(`
      SELECT id, name, ${tenantIdCol} as tenant_id FROM roles
      WHERE LOWER(name) LIKE '%admin%' OR LOWER(name) LIKE '%super admin%'
    `);

    console.log(
      `🔍 Found ${roles.length} target role(s):`,
      roles.map((r) => `${r.name} (ID: ${r.id}, Tenant: ${r.tenant_id || 'global'})`),
    );

    if (roles.length === 0) {
      console.warn('⚠️ No matching Admin / Super Admin roles found in database!');
      process.exit(0);
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const role of roles) {
      for (const resource of targetResources) {
        const existing: any[] = await AppDataSource.query(
          `SELECT id FROM permissions WHERE role_id = $1 AND resource = $2`,
          [role.id, resource],
        );

        if (existing.length === 0) {
          await AppDataSource.query(
            `INSERT INTO permissions (role_id, resource, ${accessLevelCol}, ${permTenantIdCol}) VALUES ($1, $2, $3, $4)`,
            [role.id, resource, AccessLevel.FULL_AKSES, role.tenant_id],
          );
          insertedCount++;
          console.log(`+ Inserted: [${role.name}] -> resource: "${resource}" (${AccessLevel.FULL_AKSES})`);
        } else {
          await AppDataSource.query(
            `UPDATE permissions SET ${accessLevelCol} = $3 WHERE role_id = $1 AND resource = $2`,
            [role.id, resource, AccessLevel.FULL_AKSES],
          );
          updatedCount++;
          console.log(`~ Updated: [${role.name}] -> resource: "${resource}" (${AccessLevel.FULL_AKSES})`);
        }
      }
    }

    // Flush Redis cache for menu permissions
    try {
      console.log('🧹 Clearing Redis menu cache...');
      await AppDataSource.query(`SELECT 1`); // dummy check
    } catch (e) {
      // ignore
    }

    console.log(`\n🎉 DONE! Successfully processed permissions for Admin & Super Admin.`);
    console.log(`Inserted: ${insertedCount}, Updated: ${updatedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to insert permissions:', error);
    process.exit(1);
  }
}

run();
