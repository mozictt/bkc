// src/database/seed-runner.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Menu } from '../entities/menu.entity';
import { Role } from '../role/entities/role.entity';
import { RoleMenuPermission } from '../entities/role-menu-permissions.entity';
import { runMenuSeed } from './seeds/menu-role.seeder';
import { Tenant } from '../entities/tenant.entity';

// 1. Load environment variables dari file .env
dotenv.config();

// 2. Konfigurasi Koneksi Database
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Pastikan semua entity yang terlibat dimasukkan di sini
  entities: [Menu, Role, RoleMenuPermission, Tenant],
  synchronize: false, // Selalu false agar tidak merusak schema yang ada
  logging: true,
});

async function run() {
  try {
    console.log('⏳ Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    console.log('🌱 Starting seeding process...');

    // 3. Jalankan fungsi seeder
    await runMenuSeed(AppDataSource);

    console.log('🏁 Seeding finished successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:');
    console.error(error);
    process.exit(1);
  }
}

// Jalankan script
run();
