import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { Pendaftaran } from './pendaftaran.entity';
import type { Unit } from './unit.entity';
import type { Kelas } from './kelas.entity';
import type { Bed } from './bed.entity';
import type { Dokter } from './dokter.entity';
import type { JadwalDokter } from './jadwal-dokter.entity';

@Entity('pendaftaran_unit_history')
@Index(
  'uq_puh_tenant_pendaftaran_urutan',
  ['tenantId', 'pendaftaranId', 'urutan'],
  { unique: true },
)
@Index('uq_puh_tenant_pendaftaran_aktif', ['tenantId', 'pendaftaranId'], {
  unique: true,
  where: `"status_penempatan" = 'AKTIF'`,
})
@Index('idx_puh_tenant_jadwal_tgl', [
  'tenantId',
  'jadwalDokterId',
  'tanggalKunjungan',
])
export class PendaftaranUnitHistory extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'pendaftaran_id', type: 'int' })
  pendaftaranId: number;

  @ManyToOne('Pendaftaran', 'historyUnit', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pendaftaran_id' })
  pendaftaran: Pendaftaran;

  @Column({ type: 'int' })
  urutan: number;

  @Column({ name: 'tanggal_kunjungan', type: 'date' })
  tanggalKunjungan: string;

  @Column({ name: 'jenis_perpindahan', type: 'varchar', length: 30 })
  jenisPerpindahan: string;

  @Column({ name: 'unit_asal_id', type: 'int', nullable: true })
  unitAsalId: number | null;

  @ManyToOne('Unit', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'unit_asal_id' })
  unitAsal: Unit | null;

  @Column({ name: 'kelas_asal_id', type: 'int', nullable: true })
  kelasAsalId: number | null;

  @ManyToOne('Kelas', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'kelas_asal_id' })
  kelasAsal: Kelas | null;

  @Column({ name: 'bed_asal_id', type: 'int', nullable: true })
  bedAsalId: number | null;

  @ManyToOne('Bed', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'bed_asal_id' })
  bedAsal: Bed | null;

  @Column({ name: 'dokter_asal_id', type: 'int', nullable: true })
  dokterAsalId: number | null;

  @ManyToOne('Dokter', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'dokter_asal_id' })
  dokterAsal: Dokter | null;

  @Index()
  @Column({ name: 'unit_tujuan_id', type: 'int' })
  unitTujuanId: number;

  @ManyToOne('Unit', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_tujuan_id' })
  unitTujuan: Unit;

  @Column({ name: 'jenis_layanan_tujuan', type: 'varchar', length: 20 })
  jenisLayananTujuan: string;

  @Column({ name: 'kelas_tujuan_id', type: 'int', nullable: true })
  kelasTujuanId: number | null;

  @ManyToOne('Kelas', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'kelas_tujuan_id' })
  kelasTujuan: Kelas | null;

  @Column({ name: 'bed_tujuan_id', type: 'int', nullable: true })
  bedTujuanId: number | null;

  @ManyToOne('Bed', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'bed_tujuan_id' })
  bedTujuan: Bed | null;

  @Index()
  @Column({ name: 'dokter_tujuan_id', type: 'int' })
  dokterTujuanId: number;

  @ManyToOne('Dokter', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dokter_tujuan_id' })
  dokterTujuan: Dokter;

  @Index()
  @Column({ name: 'jadwal_dokter_id', type: 'int', nullable: true })
  jadwalDokterId: number | null;

  @ManyToOne('JadwalDokter', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'jadwal_dokter_id' })
  jadwalDokter: JadwalDokter | null;

  @Column({ name: 'no_antrean', type: 'int', nullable: true })
  noAntrean: number | null;

  @Column({
    name: 'kode_antrean',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  kodeAntrean: string | null;

  @Column({ name: 'waktu_masuk', type: 'timestamptz' })
  waktuMasuk: Date;

  @Column({ name: 'waktu_keluar', type: 'timestamptz', nullable: true })
  waktuKeluar: Date | null;

  @Column({
    name: 'status_penempatan',
    type: 'varchar',
    length: 20,
    default: 'AKTIF',
  })
  statusPenempatan: string;

  @Column({ type: 'text', nullable: true })
  alasan: string | null;

  @Column({ type: 'text', nullable: true })
  catatan: string | null;

  @Column({ name: 'diproses_oleh_id', type: 'int', nullable: true })
  diprosesOlehId: number | null;
}
