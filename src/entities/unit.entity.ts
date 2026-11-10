import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { Kelas } from './kelas.entity';

@Entity('unit')
@Index('uq_unit_tenant_kode', ['tenantId', 'kode'], { unique: true })
@Index('uq_unit_tenant_nama', ['tenantId', 'nama'], { unique: true })
export class Unit extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  kode: string;

  @Column({ type: 'varchar', length: 120 })
  nama: string;

  @Index()
  @Column({
    name: 'jenis_unit',
    type: 'varchar',
    length: 30,
    default: 'RAWAT_JALAN',
  })
  jenisUnit: string;

  @Index()
  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne('Unit', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Unit | null;

  @Index()
  @Column({ name: 'kelas_default_id', type: 'int', nullable: true })
  kelasDefaultId: number | null;

  @ManyToOne('Kelas', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'kelas_default_id' })
  kelasDefault: Kelas | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  gedung: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  lantai: string | null;

  @Column({
    name: 'no_telepon_ekstensi',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  noTeleponEkstensi: string | null;

  @Column({
    name: 'kode_bpjs_poli',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  kodeBpjsPoli: string | null;

  @Column({
    name: 'ihs_location_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  ihsLocationId: string | null;

  @Column({ name: 'is_tersedia_bed', type: 'boolean', default: false })
  isTersediaBed: boolean;

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;
}
