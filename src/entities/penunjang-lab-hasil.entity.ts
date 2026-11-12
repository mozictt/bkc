import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { PenunjangLab } from './penunjang-lab.entity';
import type { PenunjangLabItem } from './penunjang-lab-item.entity';
import type { LabParameter } from './lab-parameter.entity';

/**
 * Baris hasil pemeriksaan parameter laboratorium per pasien, termasuk snapshot nilai rujukan
 * (berdasarkan jenis kelamin & usia pasien saat pemeriksaan) serta flag abnormal/kritis.
 */
@Entity('penunjang_lab_hasil')
@Index('idx_penunjang_lab_hasil_header', [
  'tenantId',
  'penunjangLabId',
  'urutan',
])
export class PenunjangLabHasil extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'penunjang_lab_id', type: 'int' })
  penunjangLabId: number;

  @ManyToOne('PenunjangLab', 'hasilList', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'penunjang_lab_id' })
  penunjangLab: PenunjangLab;

  @Index()
  @Column({ name: 'penunjang_lab_item_id', type: 'int' })
  penunjangLabItemId: number;

  @ManyToOne('PenunjangLabItem', 'hasilList', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'penunjang_lab_item_id' })
  penunjangLabItem: PenunjangLabItem;

  @Index()
  @Column({ name: 'parameter_id', type: 'int', nullable: true })
  parameterId: number | null;

  @ManyToOne('LabParameter', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parameter_id' })
  parameter: LabParameter | null;

  @Column({ name: 'kode_parameter_snapshot', type: 'varchar', length: 30 })
  kodeParameterSnapshot: string;

  @Column({ name: 'nama_parameter_snapshot', type: 'varchar', length: 150 })
  namaParameterSnapshot: string;

  @Column({
    name: 'grup_snapshot',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  grupSnapshot: string | null;

  @Column({
    name: 'satuan_snapshot',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  satuanSnapshot: string | null;

  @Column({
    name: 'tipe_hasil_snapshot',
    type: 'varchar',
    length: 20,
    default: 'NUMERIC',
  })
  tipeHasilSnapshot: string;

  @Column({ name: 'opsi_pilihan_snapshot', type: 'jsonb', nullable: true })
  opsiPilihanSnapshot: string[] | null;

  @Column({ name: 'desimal_snapshot', type: 'int', default: 2 })
  desimalSnapshot: number;

  @Column({
    name: 'nilai_rujukan_min_snapshot',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  nilaiRujukanMinSnapshot: string | null;

  @Column({
    name: 'nilai_rujukan_max_snapshot',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  nilaiRujukanMaxSnapshot: string | null;

  @Column({
    name: 'kritis_min_snapshot',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  kritisMinSnapshot: string | null;

  @Column({
    name: 'kritis_max_snapshot',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  kritisMaxSnapshot: string | null;

  @Column({
    name: 'nilai_normal_text_snapshot',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  nilaiNormalTextSnapshot: string | null;

  @Column({ name: 'is_wajib', type: 'boolean', default: true })
  isWajib: boolean;

  @Column({ type: 'int', default: 0 })
  urutan: number;

  @Column({
    name: 'hasil_nilai',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  hasilNilai: string | null;

  @Column({
    name: 'hasil_angka',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  hasilAngka: string | null;

  @Column({
    name: 'flag_abnormal',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  flagAbnormal: string | null;

  @Column({ name: 'is_kritis', type: 'boolean', default: false })
  isKritis: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  catatan: string | null;

  @Column({ name: 'diinput_oleh_id', type: 'int', nullable: true })
  diinputOlehId: number | null;

  @Column({ name: 'diinput_pada', type: 'timestamptz', nullable: true })
  diinputPada: Date | null;
}
