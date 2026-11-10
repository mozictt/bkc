import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { Unit } from './unit.entity';
import type { Kelas } from './kelas.entity';

@Entity('bed')
@Index('uq_bed_tenant_kode', ['tenantId', 'kode'], { unique: true })
@Index('idx_bed_tenant_unit_kelas', ['tenantId', 'unitId', 'kelasId'])
export class Bed extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  kode: string;

  @Column({ type: 'varchar', length: 100 })
  nama: string;

  @Index()
  @Column({ name: 'unit_id', type: 'int' })
  unitId: number;

  @ManyToOne('Unit', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Index()
  @Column({ name: 'kelas_id', type: 'int' })
  kelasId: number;

  @ManyToOne('Kelas', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'kelas_id' })
  kelas: Kelas;

  @Column({ name: 'nama_kamar', type: 'varchar', length: 80, nullable: true })
  namaKamar: string | null;

  @Index()
  @Column({
    name: 'status_ketersediaan',
    type: 'varchar',
    length: 20,
    default: 'KOSONG',
  })
  statusKetersediaan: string;

  @Column({ name: 'is_isolasi', type: 'boolean', default: false })
  isIsolasi: boolean;

  @Column({
    name: 'ihs_location_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  ihsLocationId: string | null;

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;
}
