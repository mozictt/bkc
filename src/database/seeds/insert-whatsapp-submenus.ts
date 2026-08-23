import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

async function run() {
  try {
    console.log('⏳ Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    // Query all menus related to whatsapp
    const allWaMenus: any[] = await AppDataSource.query(`
      SELECT id, name, url, parent_id, "tenant_id" FROM menus 
      WHERE LOWER(name) LIKE '%whatsapp%' OR LOWER(url) LIKE '%whatsapp%'
    `);

    console.log('🔍 All WhatsApp menus in DB:', allWaMenus);

    // Find parent menu (either parent_id IS NULL or url = '/whatsapp')
    let waParents: any[] = allWaMenus.filter((m) => m.parent_id === null || m.url === '/whatsapp');

    if (waParents.length === 0) {
      console.log('⚠️ No existing parent WhatsApp menu found. Creating parent WhatsApp menu...');
      const createdParent: any[] = await AppDataSource.query(`
        INSERT INTO menus (name, url, icon, order_no, is_visible, is_active)
        VALUES ('Integrasi WhatsApp', NULL, 'message-square', 5, true, true)
        RETURNING id, name, "tenant_id"
      `);
      waParents = createdParent;
    }

    for (const parent of waParents) {
      // 1. Perangkat & Sesi WhatsApp (/whatsapp)
      const sub1: any[] = await AppDataSource.query(
        `SELECT id FROM menus WHERE parent_id = $1 AND url = '/whatsapp'`,
        [parent.id]
      );
      if (sub1.length === 0) {
        await AppDataSource.query(
          `INSERT INTO menus (name, url, icon, order_no, is_visible, is_active, parent_id, tenant_id)
           VALUES ('Perangkat & Sesi', '/whatsapp', 'smartphone', 1, true, true, $1, $2)`,
          [parent.id, parent.tenant_id]
        );
        console.log(`+ Created Submenu: Perangkat & Sesi (/whatsapp) under parent ID ${parent.id}`);
      }

      // 2. Master Kontak WA (/whatsapp/contacts)
      const sub2: any[] = await AppDataSource.query(
        `SELECT id FROM menus WHERE parent_id = $1 AND url = '/whatsapp/contacts'`,
        [parent.id]
      );
      if (sub2.length === 0) {
        await AppDataSource.query(
          `INSERT INTO menus (name, url, icon, order_no, is_visible, is_active, parent_id, tenant_id)
           VALUES ('Master Kontak WA', '/whatsapp/contacts', 'users', 2, true, true, $1, $2)`,
          [parent.id, parent.tenant_id]
        );
        console.log(`+ Created Submenu: Master Kontak WA (/whatsapp/contacts) under parent ID ${parent.id}`);
      }

      // 3. Riwayat Log Pesan (/whatsapp/history)
      const sub3: any[] = await AppDataSource.query(
        `SELECT id FROM menus WHERE parent_id = $1 AND url = '/whatsapp/history'`,
        [parent.id]
      );
      if (sub3.length === 0) {
        await AppDataSource.query(
          `INSERT INTO menus (name, url, icon, order_no, is_visible, is_active, parent_id, tenant_id)
           VALUES ('Riwayat Log Pesan', '/whatsapp/history', 'history', 3, true, true, $1, $2)`,
          [parent.id, parent.tenant_id]
        );
        console.log(`+ Created Submenu: Riwayat Log Pesan (/whatsapp/history) under parent ID ${parent.id}`);
      }
    }

    console.log('\n🎉 WhatsApp submenus successfully processed in database!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to insert WhatsApp submenus:', err);
    process.exit(1);
  }
}

run();
