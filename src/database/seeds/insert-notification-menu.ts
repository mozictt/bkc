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

    // Query parent menu 'Pesan'
    const parentMenus: any[] = await AppDataSource.query(`
      SELECT id, name, url, parent_id, "tenant_id" FROM menus 
      WHERE LOWER(name) = 'pesan' OR LOWER(name) LIKE '%pesan%'
    `);

    console.log('🔍 Parent Pesan menus in DB:', parentMenus);

    let pesanParents: any[] = parentMenus.filter((m) => m.parent_id === null);

    if (pesanParents.length === 0) {
      console.log('⚠️ No existing parent Pesan menu found. Creating parent Pesan menu...');
      const createdParent: any[] = await AppDataSource.query(`
        INSERT INTO menus (name, url, icon, order_no, is_visible, is_active)
        VALUES ('Pesan', NULL, 'message-square', 4, true, true)
        RETURNING id, name, "tenant_id"
      `);
      pesanParents = createdParent;
    }

    for (const parent of pesanParents) {
      // 1. Submenu Chat Internal (/chat)
      const subChat: any[] = await AppDataSource.query(
        `SELECT id FROM menus WHERE (parent_id = $1 OR parent_id IS NULL) AND url = '/chat'`,
        [parent.id]
      );
      if (subChat.length === 0) {
        await AppDataSource.query(
          `INSERT INTO menus (name, url, icon, order_no, is_visible, is_active, parent_id, tenant_id, "required_resource")
           VALUES ('Chat Internal', '/chat', 'MessageSquare', 1, true, true, $1, $2, 'menu-chat')`,
          [parent.id, parent.tenant_id]
        );
        console.log(`+ Created Submenu: Chat Internal (/chat) under parent ID ${parent.id}`);
      } else {
        // Ensure parent_id is set
        await AppDataSource.query(
          `UPDATE menus SET parent_id = $1, "required_resource" = 'menu-chat', is_visible = true WHERE url = '/chat'`,
          [parent.id]
        );
      }

      // 2. Submenu Notifikasi Chat (/chat/notifications)
      const subNotif: any[] = await AppDataSource.query(
        `SELECT id FROM menus WHERE url = '/chat/notifications' OR url = '/notifications'`,
      );
      if (subNotif.length === 0) {
        await AppDataSource.query(
          `INSERT INTO menus (name, url, icon, order_no, is_visible, is_active, parent_id, tenant_id, "required_resource")
           VALUES ('Notifikasi Chat', '/chat/notifications', 'Bell', 2, true, true, $1, $2, 'menu-notifikasi-chat')`,
          [parent.id, parent.tenant_id]
        );
        console.log(`+ Created Submenu: Notifikasi Chat (/chat/notifications) under parent ID ${parent.id}`);
      } else {
        await AppDataSource.query(
          `UPDATE menus SET parent_id = $1, "required_resource" = 'menu-notifikasi-chat', is_visible = true WHERE url = '/chat/notifications' OR url = '/notifications'`,
          [parent.id]
        );
      }
    }

    console.log('\n🎉 Notification & Chat submenus successfully inserted/updated in database!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to insert Notification submenus:', err);
    process.exit(1);
  }
}

run();
