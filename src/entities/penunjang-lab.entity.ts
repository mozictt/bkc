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
import type { Pendaftaran } from './pendaftaran.entity';
import type { Pasien } from './pasien.entity';
import type { Unit } from './unit.entity';
import type { Dokter } from './dokter.entity';
import type { Pegawai } from './pegawai.entity';
import type { PenunjangLabItem } from './penunjang-lab-item.entity';
import type { PenunjangLabHasil } from './penunjang-lab-hasil.entity';

/**
 * Header transaksi pemeriksaan penunjang laboratorium untuk kunjungan pasien aktif / belum bayar.
 */
@Entity('penunjang_lab')
@Index('uq_penunjang_lab_tenant_nolab', ['tenantId', 'noLab'], {
  unique: true,
})
@Index('idx_penunjang_lab_tenant_waktu_status', [
  'tenantId',
  'waktuOrder',
  'statusLab',
])
export class PenunjangLab extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'no_lab', type: 'varchar', length: 30 })
  noLab: string;

  @Index()
  @Column({ name: 'pendaftaran_id', type: 'int' })
  pendaftaranId: number;

  @ManyToOne('Pendaftaran', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pendaftaran_id' })
  pendaftaran: Pendaftaran;

  @Index()
  @Column({ name: 'pasien_id', type: 'int' })
  pasienId: number;

  @ManyToOne('Pasien', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pasien_id' })
  pasien: Pasien;

  @Column({ name: 'unit_pengirim_id', type: 'int', nullable: true })
  unitPengirimId: number | null;

  @ManyToOne('Unit', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'unit_pengirim_id' })
  unitPengirim: Unit | null;

  @Column({ name: 'unit_lab_id', type: 'int', nullable: true })
  unitLabId: number | null;

  @ManyToOne('Unit', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'unit_lab_id' })
  unitLab: Unit | null;

  @Column({ name: 'dokter_pengirim_id', type: 'int', nullable: true })
  dokterPengirimId: number | null;

  @ManyToOne('Dokter', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'dokter_pengirim_id' })
  dokterPengirim: Dokter | null;

  @Column({ name: 'dokter_lab_id', type: 'int', nullable: true })
  dokterLabId: number | null;

  @ManyToOne('Dokter', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'dokter_lab_id' })
  dokterLab: Dokter | null;

  @Column({ name: 'petugas_lab_id', type: 'int', nullable: true })
  petugasLabId: number | null;

  @ManyToOne('Pegawai', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'petugas_lab_id' })
  petugasLab: Pegawai | null;

  @Column({ name: 'penjamin_id_snapshot', type: 'int', nullable: true })
  penjaminIdSnapshot: number | null;

  @Column({ name: 'kelas_id_snapshot', type: 'int', nullable: true })
  kelasIdSnapshot: number | null;

  @Column({ name: 'waktu_order', type: 'timestamptz' })
  waktuOrder: Date;

  @Column({ name: 'waktu_sampel_diambil', type: 'timestamptz', nullable: true })
  waktuSampelDiambil: Date | null;

  @Column({ name: 'waktu_hasil_selesai', type: 'timestamptz', nullable: true })
  waktuHasilSelesai: Date | null;

  @Column({ name: 'waktu_verifikasi', type: 'timestamptz', nullable: true })
  waktuVerifikasi: Date | null;

  @Index()
  @Column({
    name: 'status_lab',
    type: 'varchar',
    length: 20,
    default: 'DIPROSES',
  })
  statusLab: string;

  @Column({
    name: 'status_pembayaran',
    type: 'varchar',
    length: 30,
    default: 'BELUM_BAYAR',
  })
  statusPembayaran: string;

  @Column({ name: 'is_cito', type: 'boolean', default: false })
  isCito: boolean;

  @Column({
    name: 'diagnosa_klinis',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  diagnosaKlinis: string | null;

  @Column({ name: 'catatan_klinis', type: 'text', nullable: true })
  catatanKlinis: string | null;

  @Column({ name: 'kesan_lab', type: 'text', nullable: true })
  kesanLab: string | null;

  @Column({ name: 'alasan_batal', type: 'text', nullable: true })
  alasanBatal: string | null;

  @Column({
    name: 'total_tarif',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  totalTarif: string;

  @Column({
    name: 'total_jasa_dokter',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  totalJasaDokter: string;

  @Column({
    name: 'total_jasa_nakes',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  totalJasaNakes: string;

  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @Column({ name: 'updated_by_id', type: 'int', nullable: true })
  updatedById: number | null;

  @Column({ name: 'verified_by_id', type: 'int', nullable: true })
  verifiedById: number | null;

  @OneToMany('PenunjangLabItem', 'penunjangLab')
  items: PenunjangLabItem[];

  @OneToMany('PenunjangLabHasil', 'penunjangLab')
  hasilList: PenunjangLabHasil[];
}
