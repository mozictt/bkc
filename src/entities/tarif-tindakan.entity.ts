import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { TarifLayanan } from './tarif-layanan.entity';

/**
 * Katalog master tindakan, pemeriksaan laboratorium, dan pemeriksaan radiologi per tenant.
 */
@Entity('tarif_tindakan')
@Index('uq_tarif_tindakan_tenant_kode', ['tenantId', 'kode'], { unique: true })
@Index('uq_tarif_tindakan_tenant_nama_jenis', ['tenantId', 'nama', 'jenisTarif'], {
  unique: true,
})
@Index('idx_tarif_tindakan_tenant_jenis_status', [
  'tenantId',
  'jenisTarif',
  'status',
])
export class TarifTindakan extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  kode: string;

  @Column({ type: 'varchar', length: 180 })
  nama: string;

  @Column({
    name: 'jenis_tarif',
    type: 'varchar',
    length: 20,
    default: 'BIASA',
  })
  jenisTarif: string;

  @Column({
    name: 'kelompok_tarif',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  kelompokTarif: string | null;

  @Column({ type: 'varchar', length: 30, default: 'Tindakan' })
  satuan: string;

  @Column({
    name: 'kode_eksternal',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  kodeEksternal: string | null;

  @Column({ name: 'atribut_khusus', type: 'jsonb', nullable: true })
  atributKhusus: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;

  @OneToMany('TarifLayanan', 'tindakan')
  daftarHarga: TarifLayanan[];
}
