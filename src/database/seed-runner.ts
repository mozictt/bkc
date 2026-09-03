// src/database/seed-runner.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Menu } from '../entities/menu.entity';
import { Role } from '../role/entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { runMenuSeed } from './seeds/menu-role.seeder';
import { runMasterTenantSeed } from './seeds/master-tenant.seeder';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { Pegawai } from '../entities/pegawai.entity';
import { Provinsi } from '../entities/provinsi.entity';
import { Kabupaten } from '../entities/kabupaten.entity';
import { Kecamatan } from '../entities/kecamatan.entity';
import { Kelurahan } from '../entities/kelurahan.entity';
import { runWilayahSeed } from './seeds/wilayah.seeder';

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
  entities: [Menu, Role, Permission, Tenant, User, Pegawai, Provinsi, Kabupaten, Kecamatan, Kelurahan],
  synchronize: false, // Selalu false agar tidak merusak schema yang ada
  logging: true,
});

async function run() {
  try {
    console.log('⏳ Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    console.log('🌱 Starting seeding process...');

    // 3. Jalankan fungsi seeder secara berurutan
    // Step 1: Master Tenant (Atomik & Transaksional) → harus dijalankan pertama kali
    await runMasterTenantSeed(AppDataSource);

    // Step 2: Menu & Role Seeder (legacy, akan di-migrate ke master seeder)
    await runMenuSeed(AppDataSource);

    // Step 3: Data Wilayah
    await runWilayahSeed(AppDataSource);

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

