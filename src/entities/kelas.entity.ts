import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';

@Entity('kelas')
@Index('uq_kelas_tenant_kode', ['tenantId', 'kode'], { unique: true })
@Index('uq_kelas_tenant_nama', ['tenantId', 'nama'], { unique: true })
export class Kelas extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  kode: string;

  @Column({ type: 'varchar', length: 100 })
  nama: string;

  @Column({ type: 'int', default: 0 })
  urutan: number;

  @Column({
    name: 'kode_bpjs_aplicare',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  kodeBpjsAplicare: string | null;

  @Column({
    name: 'tarif_akomodasi',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  tarifAkomodasi: string | null;

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;
}
