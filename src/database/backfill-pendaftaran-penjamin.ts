import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Menu } from '../entities/menu.entity';
import { Permission } from '../entities/permission.entity';
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

dotenv.config();

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
  logging: false,
});

async function run() {
  try {
    console.log('⏳ Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected!');

    const regCheck = (await AppDataSource.query(
      `SELECT to_regclass('public.pendaftaran') AS table_name`,
    )) as Array<{ table_name: string | null }>;

    if (!regCheck[0]?.table_name) {
      console.log(
        'ℹ️ Tabel pendaftaran belum tersedia, backfill dilewati.',
      );
      await AppDataSource.destroy();
      process.exit(0);
    }

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS pendaftaran_penjamin (
        id SERIAL PRIMARY KEY,
        tenant_id uuid REFERENCES tenants(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        pendaftaran_id int NOT NULL REFERENCES pendaftaran(id) ON DELETE CASCADE,
        urutan int NOT NULL DEFAULT 1,
        is_utama boolean NOT NULL DEFAULT false,
        jenis_penjamin varchar(30) NOT NULL,
        penjamin_id int REFERENCES penjamin(id) ON DELETE RESTRICT,
        pasien_penjamin_id int REFERENCES pasien_penjamin(id) ON DELETE SET NULL,
        nama_penjamin_snapshot varchar(120) NOT NULL,
        no_kartu_snapshot varchar(50),
        kelas_hak_id_snapshot int REFERENCES kelas(id) ON DELETE RESTRICT,
        no_sep varchar(50),
        no_rujukan varchar(50),
        keterangan varchar(255),
        created_by_id int,
        updated_by_id int
      )
    `);

    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ppj_tenant_pendaftaran_urutan
      ON pendaftaran_penjamin (tenant_id, pendaftaran_id, urutan)
    `);
    await AppDataSource.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ppj_tenant_pendaftaran_utama
      ON pendaftaran_penjamin (tenant_id, pendaftaran_id)
      WHERE is_utama = true
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_ppj_tenant_pendaftaran
      ON pendaftaran_penjamin (tenant_id, pendaftaran_id)
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_ppj_tenant_penjamin
      ON pendaftaran_penjamin (tenant_id, penjamin_id)
    `);
    await AppDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_ppj_tenant_jenis_penjamin
      ON pendaftaran_penjamin (tenant_id, jenis_penjamin)
    `);

    const inserted = (await AppDataSource.query(`
      INSERT INTO pendaftaran_penjamin (
        tenant_id,
        created_at,
        updated_at,
        pendaftaran_id,
        urutan,
        is_utama,
        jenis_penjamin,
        penjamin_id,
        pasien_penjamin_id,
        nama_penjamin_snapshot,
        no_kartu_snapshot,
        kelas_hak_id_snapshot,
        no_sep,
        no_rujukan,
        created_by_id,
        updated_by_id
      )
      SELECT
        p.tenant_id,
        p.created_at,
        p.updated_at,
        p.id,
        1,
        true,
        p.jenis_penjamin,
        p.penjamin_id,
        p.pasien_penjamin_id,
        p.nama_penjamin_snapshot,
        p.no_kartu_snapshot,
        p.kelas_hak_id_snapshot,
        p.no_sep,
        p.no_rujukan,
        p.created_by_id,
        p.updated_by_id
      FROM pendaftaran p
      WHERE NOT EXISTS (
        SELECT pp.id
        FROM pendaftaran_penjamin pp
        WHERE pp.pendaftaran_id = p.id
          AND pp.tenant_id IS NOT DISTINCT FROM p.tenant_id
      )
      RETURNING id
    `)) as Array<{ id: number }>;

    console.log(
      `✅ Backfill pendaftaran_penjamin selesai (${inserted.length} kunjungan dimigrasi).`,
    );

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill pendaftaran_penjamin failed:');
    console.error(error);
    process.exit(1);
  }
}

run();
