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
import type { PenunjangLab } from './penunjang-lab.entity';
import type { TarifTindakan } from './tarif-tindakan.entity';
import type { TarifLayanan } from './tarif-layanan.entity';
import type { PenunjangLabHasil } from './penunjang-lab-hasil.entity';

/**
 * Snapshot item tindakan tarif laboratorium yang diorder beserta rincian nominal Jasa Dokter & Nakes.
 */
@Entity('penunjang_lab_item')
@Index('idx_penunjang_lab_item_header', ['tenantId', 'penunjangLabId'])
export class PenunjangLabItem extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'penunjang_lab_id', type: 'int' })
  penunjangLabId: number;

  @ManyToOne('PenunjangLab', 'items', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'penunjang_lab_id' })
  penunjangLab: PenunjangLab;

  @Index()
  @Column({ name: 'tindakan_id', type: 'int' })
  tindakanId: number;

  @ManyToOne('TarifTindakan', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tindakan_id' })
  tindakan: TarifTindakan;

  @Column({ name: 'tarif_layanan_id', type: 'int', nullable: true })
  tarifLayananId: number | null;

  @ManyToOne('TarifLayanan', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tarif_layanan_id' })
  tarifLayanan: TarifLayanan | null;

  @Column({ name: 'kode_tindakan_snapshot', type: 'varchar', length: 30 })
  kodeTindakanSnapshot: string;

  @Column({ name: 'nama_tindakan_snapshot', type: 'varchar', length: 180 })
  namaTindakanSnapshot: string;

  @Column({
    name: 'satuan_snapshot',
    type: 'varchar',
    length: 30,
    default: 'Pemeriksaan',
  })
  satuanSnapshot: string;

  @Column({
    name: 'jasa_sarana',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  jasaSarana: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: '0.00' })
  bhp: string;

  @Column({
    name: 'jasa_dokter',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  jasaDokter: string;

  @Column({
    name: 'jasa_nakes',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  jasaNakes: string;

  @Column({
    name: 'tarif_satuan',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  tarifSatuan: string;

  @Column({ type: 'int', default: 1 })
  qty: number;

  @Column({
    name: 'subtotal_tarif',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  subtotalTarif: string;

  @Column({
    name: 'specificity_score_snapshot',
    type: 'int',
    nullable: true,
  })
  specificityScoreSnapshot: number | null;

  @Column({
    name: 'keterangan_tarif_snapshot',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  keteranganTarifSnapshot: string | null;

  @Column({ type: 'int', default: 0 })
  urutan: number;

  @OneToMany('PenunjangLabHasil', 'penunjangLabItem')
  hasilList: PenunjangLabHasil[];
}
