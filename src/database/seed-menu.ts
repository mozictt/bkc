import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Menu } from '../entities/menu.entity';
import { Role } from '../role/entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { Pegawai } from '../entities/pegawai.entity';
import { Penduduk } from '../entities/penduduk.entity';
import { Dokter } from '../entities/dokter.entity';
import { Pasien } from '../entities/pasien.entity';
import { PasienPenjamin } from '../entities/pasien-penjamin.entity';
import { Penjamin } from '../entities/penjamin.entity';
import { TenantCounter } from '../entities/tenant-counter.entity';
import { Kelas } from '../entities/kelas.entity';
import { Unit } from '../entities/unit.entity';
import { Bed } from '../entities/bed.entity';
import { JadwalDokter } from '../entities/jadwal-dokter.entity';
import { TarifTindakan } from '../entities/tarif-tindakan.entity';
import { TarifLayanan } from '../entities/tarif-layanan.entity';
import { LabParameter } from '../entities/lab-parameter.entity';
import { LabParameterRujukan } from '../entities/lab-parameter-rujukan.entity';
import { LabTindakanParameter } from '../entities/lab-tindakan-parameter.entity';
import { PenunjangLab } from '../entities/penunjang-lab.entity';
import { PenunjangLabItem } from '../entities/penunjang-lab-item.entity';
import { PenunjangLabHasil } from '../entities/penunjang-lab-hasil.entity';
import { Pendaftaran } from '../entities/pendaftaran.entity';
import { PendaftaranUnitHistory } from '../entities/pendaftaran-unit-history.entity';
import { PendaftaranPenjamin } from '../entities/pendaftaran-penjamin.entity';
import { Agama } from '../entities/agama.entity';
import { Pendidikan } from '../entities/pendidikan.entity';
import { Pekerjaan } from '../entities/pekerjaan.entity';
import { Suku } from '../entities/suku.entity';
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
  entities: [
    Menu,
    Role,
    Permission,
    Tenant,
    User,
    Pegawai,
    Penduduk,
    Dokter,
    Pasien,
    PasienPenjamin,
    Penjamin,
    TenantCounter,
    Kelas,
    Unit,
    Bed,
    JadwalDokter,
    TarifTindakan,
    TarifLayanan,
    LabParameter,
    LabParameterRujukan,
    LabTindakanParameter,
    PenunjangLab,
    PenunjangLabItem,
    PenunjangLabHasil,
    Pendaftaran,
    PendaftaranUnitHistory,
    PendaftaranPenjamin,
    Agama,
    Pendidikan,
    Pekerjaan,
    Suku,
    Provinsi,
    Kabupaten,
    Kecamatan,
    Kelurahan,
  ],
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
