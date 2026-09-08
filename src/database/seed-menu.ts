import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Menu } from '../entities/menu.entity';
import { Role } from '../role/entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { Pegawai } from '../entities/pegawai.entity';
import { Provinsi } from '../entities/provinsi.entity';
import { Kabupaten } from '../entities/kabupaten.entity';
import { Kecamatan } from '../entities/kecamatan.entity';
import { Kelurahan } from '../entities/kelurahan.entity';
import { runMenuSeed } from './seeds/menu-role.seeder';

// 1. Load environment variables dari .env
dotenv.config();

// 2. Konfigurasi Koneksi Database Khusus Seeder Menu & Permission
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [Menu, Role, Permission, Tenant, User, Pegawai, Provinsi, Kabupaten, Kecamatan, Kelurahan],
  synchronize: false,
  logging: true,
});

async function run() {
  try {
    console.log('⏳ Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    console.log('🌱 Starting Menu & Role Seeding process...');

    // Jalankan seeder menu & role saja
    await runMenuSeed(AppDataSource);

    console.log('🏁 Menu & Role seeding finished successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Menu & Role seeding failed:');
    console.error(error);
    process.exit(1);
  }
}

run();
