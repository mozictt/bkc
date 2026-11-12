import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { TarifTindakan } from './tarif-tindakan.entity';
import type { Unit } from './unit.entity';
import type { Penjamin } from './penjamin.entity';
import type { Kelas } from './kelas.entity';

/**
 * Matriks tarif layanan per kombinasi Unit, Penjamin, dan Kelas (NULL berarti berlaku umum/semua),
 * beserta rincian komponen Jasa Sarana, BHP, Jasa Dokter, dan Jasa Nakes.
 */
@Entity('tarif_layanan')
@Index('idx_tarif_layanan_lookup', [
  'tenantId',
  'tindakanId',
  'unitId',
  'penjaminId',
  'kelasId',
  'status',
])
@Index('idx_tarif_layanan_tindakan_status', [
  'tenantId',
  'tindakanId',
  'status',
])
export class TarifLayanan extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'tindakan_id', type: 'int' })
  tindakanId: number;

  @ManyToOne('TarifTindakan', 'daftarHarga', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tindakan_id' })
  tindakan: TarifTindakan;

  @Index()
  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId: number | null;

  @ManyToOne('Unit', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit | null;

  @Index()
  @Column({ name: 'penjamin_id', type: 'int', nullable: true })
  penjaminId: number | null;

  @ManyToOne('Penjamin', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'penjamin_id' })
  penjamin: Penjamin | null;

  @Index()
  @Column({ name: 'kelas_id', type: 'int', nullable: true })
  kelasId: number | null;

  @ManyToOne('Kelas', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'kelas_id' })
  kelas: Kelas | null;

  @Column({
    name: 'jasa_sarana',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  jasaSarana: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
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
    name: 'total_tarif',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: '0.00',
  })
  totalTarif: string;

  @Column({
    name: 'berlaku_mulai',
    type: 'date',
    default: () => 'CURRENT_DATE',
  })
  berlakuMulai: string;

  @Column({ name: 'berlaku_sampai', type: 'date', nullable: true })
  berlakuSampai: string | null;

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;
}
