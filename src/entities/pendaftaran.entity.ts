import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { Pasien } from './pasien.entity';
import type { Unit } from './unit.entity';
import type { Dokter } from './dokter.entity';
import type { JadwalDokter } from './jadwal-dokter.entity';
import type { Kelas } from './kelas.entity';
import type { Bed } from './bed.entity';
import type { Penjamin } from './penjamin.entity';
import type { PasienPenjamin } from './pasien-penjamin.entity';
import type { PendaftaranUnitHistory } from './pendaftaran-unit-history.entity';
import type { PendaftaranPenjamin } from './pendaftaran-penjamin.entity';

@Entity('pendaftaran')
@Index('uq_pendaftaran_tenant_noreg', ['tenantId', 'noRegistrasi'], {
  unique: true,
})
@Index('idx_pendaftaran_tenant_tgl_status', [
  'tenantId',
  'tanggalKunjungan',
  'statusKunjungan',
])
@Index('idx_pendaftaran_tenant_unit_status', [
  'tenantId',
  'unitSaatIniId',
  'statusKunjungan',
])
@Index('idx_pendaftaran_tenant_pasien_status', [
  'tenantId',
  'pasienId',
  'statusKunjungan',
])
@Index('uq_pendaftaran_ranap_aktif', ['tenantId', 'pasienId'], {
  unique: true,
  where: `"jenis_layanan_saat_ini" IN ('RAWAT_INAP', 'INTENSIVE') AND "status_kunjungan" IN ('TERDAFTAR', 'DALAM_PELAYANAN', 'DIRAWAT')`,
})
export class Pendaftaran extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'no_registrasi', type: 'varchar', length: 30 })
  noRegistrasi: string;

  @Index()
  @Column({ name: 'pasien_id', type: 'int' })
  pasienId: number;

  @ManyToOne('Pasien', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pasien_id' })
  pasien: Pasien;

  @Column({ name: 'tanggal_kunjungan', type: 'date' })
  tanggalKunjungan: string;

  @Column({ name: 'waktu_daftar', type: 'timestamptz' })
  waktuDaftar: Date;

  @Column({ name: 'jenis_layanan_awal', type: 'varchar', length: 20 })
  jenisLayananAwal: string;

  @Column({ name: 'jenis_layanan_saat_ini', type: 'varchar', length: 20 })
  jenisLayananSaatIni: string;

  @Index()
  @Column({ name: 'unit_saat_ini_id', type: 'int' })
  unitSaatIniId: number;

  @ManyToOne('Unit', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_saat_ini_id' })
  unitSaatIni: Unit;

  @Index()
  @Column({ name: 'dokter_saat_ini_id', type: 'int' })
  dokterSaatIniId: number;

  @ManyToOne('Dokter', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dokter_saat_ini_id' })
  dokterSaatIni: Dokter;

  @Index()
  @Column({ name: 'jadwal_dokter_saat_ini_id', type: 'int', nullable: true })
  jadwalDokterSaatIniId: number | null;

  @ManyToOne('JadwalDokter', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'jadwal_dokter_saat_ini_id' })
  jadwalDokterSaatIni: JadwalDokter | null;

  @Index()
  @Column({ name: 'kelas_saat_ini_id', type: 'int', nullable: true })
  kelasSaatIniId: number | null;

  @ManyToOne('Kelas', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'kelas_saat_ini_id' })
  kelasSaatIni: Kelas | null;

  @Index()
  @Column({ name: 'bed_saat_ini_id', type: 'int', nullable: true })
  bedSaatIniId: number | null;

  @ManyToOne('Bed', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'bed_saat_ini_id' })
  bedSaatIni: Bed | null;

  @Column({ name: 'no_antrean_saat_ini', type: 'int', nullable: true })
  noAntreanSaatIni: number | null;

  @Column({
    name: 'kode_antrean_saat_ini',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  kodeAntreanSaatIni: string | null;

  @Column({
    name: 'cara_masuk',
    type: 'varchar',
    length: 30,
    default: 'DATANG_SENDIRI',
  })
  caraMasuk: string;

  @Column({
    name: 'asal_rujukan',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  asalRujukan: string | null;

  @Column({ name: 'keluhan_utama', type: 'text', nullable: true })
  keluhanUtama: string | null;

  @Column({ name: 'jenis_penjamin', type: 'varchar', length: 30 })
  jenisPenjamin: string;

  @Index()
  @Column({ name: 'penjamin_id', type: 'int', nullable: true })
  penjaminId: number | null;

  @ManyToOne('Penjamin', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'penjamin_id' })
  penjamin: Penjamin | null;

  @Index()
  @Column({ name: 'pasien_penjamin_id', type: 'int', nullable: true })
  pasienPenjaminId: number | null;

  @ManyToOne('PasienPenjamin', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'pasien_penjamin_id' })
  pasienPenjamin: PasienPenjamin | null;

  @Column({
    name: 'nama_penjamin_snapshot',
    type: 'varchar',
    length: 120,
  })
  namaPenjaminSnapshot: string;

  @Column({
    name: 'no_kartu_snapshot',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  noKartuSnapshot: string | null;

  @Column({ name: 'kelas_hak_id_snapshot', type: 'int', nullable: true })
  kelasHakIdSnapshot: number | null;

  @ManyToOne('Kelas', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'kelas_hak_id_snapshot' })
  kelasHakSnapshot: Kelas | null;

  @Column({ name: 'no_sep', type: 'varchar', length: 50, nullable: true })
  noSep: string | null;

  @Column({ name: 'no_rujukan', type: 'varchar', length: 50, nullable: true })
  noRujukan: string | null;

  @Column({
    name: 'status_kunjungan',
    type: 'varchar',
    length: 30,
    default: 'TERDAFTAR',
  })
  statusKunjungan: string;

  @Index()
  @Column({
    name: 'status_pembayaran',
    type: 'varchar',
    length: 30,
    default: 'BELUM_BAYAR',
  })
  statusPembayaran: string;

  @Column({ name: 'waktu_keluar', type: 'timestamptz', nullable: true })
  waktuKeluar: Date | null;

  @Column({
    name: 'cara_keluar',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  caraKeluar: string | null;

  @Column({ name: 'alasan_batal', type: 'text', nullable: true })
  alasanBatal: string | null;

  @Column({ type: 'text', nullable: true })
  catatan: string | null;

  @Column({
    name: 'ihs_encounter_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  ihsEncounterId: string | null;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @Column({ name: 'updated_by_id', type: 'int', nullable: true })
  updatedById: number | null;

  @OneToMany('PendaftaranUnitHistory', 'pendaftaran')
  historyUnit: PendaftaranUnitHistory[];

  @OneToMany('PendaftaranPenjamin', 'pendaftaran')
  penjaminList: PendaftaranPenjamin[];
}

